const express = require("express");
const { pool } = require("./dbConfig");
const { DBLog, DBLogError } = require("./logger");
const bcrypt = require("bcrypt");
const passport = require("passport");
const flash = require("express-flash");
const session = require("express-session");
require("dotenv").config();
const path = require(`path`);
var bodyParser = require('body-parser')
//const nodemailer = require('nodemailer');

const cors = require('cors');
const axios = require('axios');

const { EmailClient } = require("@azure/communication-email");
const connectionString = process.env['AZURE_EMAIL_CONNECTION_STRING'];
const EmailCl = new EmailClient(connectionString);

const app = express();
const PORT = process.env.PORT || 3000;

const initializePassport = require("./passportConfig");
const { throws } = require("assert");
const { get } = require("http");
initializePassport(passport);

// Parses details from a form
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.json())

app.set("view engine", "ejs");

app.use(
  session({
    // Key we want to keep secret which will encrypt all of our information
    secret: process.env.SESSION_SECRET,
    // Should we resave our session variables if nothing has changes which we dont
    resave: false,
    // Save empty value if there is no vaue which we do not want to do
    saveUninitialized: false
  })
);
// Funtion inside passport which initializes passport
app.use(passport.initialize());
// Store our variables to be persisted across the whole session. Works with app.use(Session) above
app.use(passport.session());
app.use(flash());

app.set('case sensitive routing', true);

// Create a transporter object using custom SMTP settings
/* I WILL COME BACK TO SELF HOSTED FCK MICROSOFT
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVICE_URL,
  port: process.env.EMAIL_SERVICE_PORT,
  secure: false,
  auth: {
    user: 'master@fn.lkev.in',
    pass: process.env.EMAIL_SERVICE_PASSWORD,
  },
  tls: {
    ca: Buffer.from(process.env.EMAIL_SERVICE_TLS, 'base64').toString('utf-8'),
    rejectUnauthorized: false
  }
});
*/

app.use((req, res, next) => {
  const ext = path.extname(req.originalUrl);
  if (req.method === 'GET' && !ext && req.originalUrl !== '/health' && req.originalUrl !== '/status' && req.originalUrl !== '/calendar') {
    console.log("[" + req.get('host') + "] GET " + req.originalUrl);
    if(req.hostname != 'localhost') DBLog(req.get('host'));
  }
  next();
});

const printConsoleError = console.error;
console.error = async function (...args) {
  // Send error message to DB
  const errorMessage = args.join(' ');
  DBLogError(errorMessage);
  // Print the error to the console
  printConsoleError.apply(console, args);
};

app.get("/", async (req, res) => {
  res.render("index.ejs", { isLogged: req.isAuthenticated(), email: req.isAuthenticated() ? req.user.email : null });
});

app.get("/calendar", cors(), async (req, res) => {
  let url = "https://docs.google.com/spreadsheets/d/1ADaUVRQeYU078-suUxGk0u1aMj_GbcjsAzG11YlMp5g/"
  let format = req.query.format;
  switch(format) {
    case "csv":
      url += "gviz/tq?tqx=out:csv";
      const response = await axios.get(url);
      res.set('Content-Type', 'text/csv');  // Set the response content type to CSV
      res.send(response.data);
      break;
    default:
    res.redirect(url);
    break;
  }
});

app.get("/faq", async (req, res) => {
  res.render("faq.ejs", { isLogged: req.isAuthenticated() });
});

app.get("/register", checkAuthenticated, async (req, res) => {
  res.render("register.ejs", { isLogged: false });
});
app.post("/users/register", checkAuthenticated, async (req, res) => {

  let { name, surname, email, password, password2, gender } = req.body;

  name = name.trim();
  surname = surname.trim();

  let errors = [];

  if (!name || !surname || !email || 
      !password || !password2 || 
      !gender) {
    errors.push({ message: "Compila tutti i campi!" });
  }

  if (password.length < 6) {
    errors.push({ message: "La password deve essere lunga almeno 6 caratteri!" });
  }

  if (password !== password2) {
    errors.push({ message: "Le password non corrispondono!" });
  }

  if (errors.length > 0) {
    req.flash("error_msg", errors);
    res.redirect("/register");
    return;
  } 

  // If no errors runs as it follows
  hashedPassword = await bcrypt.hash(password, 10);
  const telegramTemporaryCode = await getTelegramTemporaryCode();
  pool.query(
    `SELECT * FROM subscribers
      WHERE email = $1`,
    [email],
    (err, results) => {
      if (err) {
        console.error("ERR REGISTER [1] " + email + ": " + err);
      }

      if (results.rows.length > 0) {
        errors.push({ message: "Email già registrata!" });
        res.render("register.ejs", { errors, isLogged : false});
      } else {
        pool.query(
          `INSERT INTO subscribers (name, surname, email, password, notifications, telegram, gender, notification_preferences)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, unsub_token, notification_preferences, email`,
          [name, surname, email, hashedPassword, -1, telegramTemporaryCode, gender, 2],
          (err, results) => {
            if (err) {
              console.error("ERR REGISTER [2] " + email + ": " + err);
              req.flash("error_msg", `Si è verificato un errore! Riprova più tardi. (${err.message})`);
            } else {
              // success db insert
              console.log("SUCCESS REGISTER WAITING FOR CONFIRMATION: " + email + " - " + telegramTemporaryCode);

              // send email
              try{
                sendMail(
                  to = email,
                  subject = `Conferma la registrazione`,
                  html = `<!doctype html><html><main style="font-family:Helvetica,Arial,Liberation Serif,sans-serif;background-color:#fff;color:#000"><table border=0 cellpadding=0 cellspacing=0 style="max-width:620px;border-collapse:collapse;margin:0 auto 0 auto;text-align:left;font-family:Helvetica,Arial,Liberation Serif,sans-serif"width=620px><tr style=background-color:#fff><td style="width:100%;padding:30px 7% 15px 7%"><a href=https://fn.lkev.in><img src=https://fn.lkev.in/email/v3/logo-long-allmuted-trasp.png style=width:70%;height:auto;color:#fff alt="FERMI NOTIFY"></a><tr style=background-color:#fff><td><table border=0 cellpadding=0 cellspacing=0 style="width:100%;background-color:#fff;padding:30px 7% 30px 7%;border:none;border-top:1px solid #ddd;border-bottom:1px solid #ddd;font-size:16px"><tr><td><h2 style="margin:10px 0">Ciao ${name}!</h2><tr><td style=text-align:left><p style=line-height:1.3>Per completare la registrazione, conferma il tuo indirizzo email:<tr><td style="padding:15px 0"><a href=https://fn.lkev.in/users/register/confirmation/${telegramTemporaryCode} style="font-size:14px;letter-spacing:1.2px;padding:13px 17px;font-weight:600;background-color:#004a77;border-radius:10px;color:#fff;text-decoration:none"target=_blank>Conferma email</a><tr><td style=text-align:left><p style=line-height:1.3>Appena completerai la registrazione, ti arriverà una seconda email con tutte le indicazioni sull'utilizzo.<tr><td style=text-align:left><p style=line-height:1.3>A presto!</table><tr style=background-color:#fff><td style="padding:15px 7% 30px 7%;font-size:13px;position:relative;background-color:#fff"><p style=color:#8b959e>Il bottone non funziona? Conferma l'email attraverso il seguente link: <a href=https://fn.lkev.in/users/register/confirmation/${telegramTemporaryCode} style=color:#004a77 target=_blank>https://fn.lkev.in/users/register/confirmation/${telegramTemporaryCode}</a>.<p style=color:#8b959e>Per supporto o informazioni, consulta la <a href=https://fn.lkev.in/faq style=color:#004a77>FAQ</a> o contattaci su Instagram <a href=https://instagram.com/ferminotify style=color:#004a77><i>@ferminotify</i></a>.</p><a href=https://fn.lkev.in><img src=https://fn.lkev.in/email/v3/icon-allmuted.png style=height:35px;margin-bottom:5px alt="Fermi Notify"></a><p style=margin:0;color:#8b959e><i style=color:#8b959e>Fermi Notify Team</i><p style=margin-top:0><a href=https://fn.lkev.in style=color:#004a77 target=_blank>fn.lkev.in</a><p style=color:#8b959e;font-size:12px>Hai ricevuto questa email perché ti sei registrat${gender == "M" ? "o" : gender == "F" ? "a" : "ə"} a <i>Fermi Notify</i>. Se non sei stato tu, ignora questa email.</table></main><html>`,
				   plainText = `Ciao ${name}! Per completare la registrazione, conferma il tuo indirizzo email: https://fn.lkev.in/users/register/confirmation/${telegramTemporaryCode}. Appena completerai la registrazione, ti arriverà una seconda email con tutte le indicazioni sull'utilizzo. A presto!`,
                  headers = {
                    "List-Unsubscribe": `<mailto:unsubscribe@fn.lkev.in?subject=Unsubscribe%20%3A%28&id=${results.rows[0].id}&token=${results.rows[0].unsub_token}&email=${results.rows[0].email}>, <https://fn.lkev.in/user/unsubscribe?id=${results.rows[0].id}&token=${results.rows[0].unsub_token}&email=${results.rows[0].email}>`
                  }
                );
                req.flash("success_msg", "Ti abbiamo inviato una mail per confermare l'account! (controlla anche lo SPAM)");
              } catch (err) {
                console.error("ERR REGISTER [3] " + email + ": " + error);
                  
                // delete record from db
                pool.query(`DELETE FROM subscribers WHERE id = $1`, [results.rows[0].id], (err) => {
                  if (err){
                    req.flash("error_msg", `Si è verificato un errore! Eliminazione record dal database non riuscita. Per favore, contattaci su Instagram @ferminotify.`);
                    console.error("ERR REGISTER [3.1] " + email + ": " + err);
                  }
                  res.redirect("/login");
                  return;
                });

                req.flash("error_msg", `Si è verificato un errore! Riprova più tardi. (${error.message})`);
              }

            }
            res.redirect("/login");
          }
        );
      }
    }
  );

});

// GET LOGIN
app.get("/login", checkAuthenticated, (req, res) => {
  // flash sets a messages variable. passport sets the error message
  if (req.session.flash != undefined && req.session.flash.error != undefined){
    console.error("ERR LOG IN: " + req.session.flash.error);
    // temp fix TODO
    req.flash("error_msg", req.session.flash.error);
  }
  res.render("login.ejs", { isLogged: false });
});

// POST LOGIN
// Middleware to save the returnTo URL before authentication
function saveReturnTo(req, res, next) {
  if (req.session.returnTo) {
    res.locals.returnTo = req.session.returnTo; // Store it temporarily in `res.locals`
  }
  next();
}
app.post(
  "/login",
  saveReturnTo,
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (req, res) => {
    // Retrieve the saved returnTo URL or default to /dashboard
    const redirectUrl = res.locals.returnTo || "/dashboard";
    delete req.session.returnTo; // Clean up the session
    res.redirect(redirectUrl);
  }
);


app.get("/dashboard", checkNotAuthenticated, async (req, res) => {

  let userInfo = await getInfoByUser(req.user);
  
  console.log("SUCCESS LOG IN: " + req.user.email + " - kw: " + userInfo.tags);

  res.render("dashboard", { 
    isLogged: true,
    user_firstname: userInfo.name,
    user_lastname: userInfo.surname,
    keywords: userInfo.tags,
    tgun: userInfo.telegram,
    n_not: userInfo.notifications,
    user_gender: userInfo.gender,
    n_pref: userInfo.notification_preferences,
    n_day_before: userInfo.notification_day_before,
    n_time: userInfo.notification_time,
    email: userInfo.email
  });
});

app.get("/users/register/confirmation/:id", async (req, res, next) => {

  let userId = req.params.id;

  let email = await getUserEmailWithTelegramID(userId);

  if(email == undefined){
    req.flash("error_msg", "Link di conferma non valido!");
    console.error("ERR CONFIRMATION " + userId + ": email not found");
    return res.redirect("/login");
  }

  if(await getNumberNotification(email) > -1){
    req.flash("error_msg", "Account già confermato! Fai il login per accedere.");
    return res.redirect("/login");
  }

  let gender = await getGenderByEmail(email);
  let name = await getFirstNameByEmail(email);

  let unsub_info = await getUnsubscribeInfoByEmail(email);

  // send welcome email
  try{
	sendMail(
		to = email,
		subject = `Welcome!`,
		html = `<!doctype html><main style="font-family:Helvetica,Arial,Liberation Serif,sans-serif;background-color:#fff;color:#000"><table border=0 cellpadding=0 cellspacing=0 style="max-width:620px;border-collapse:collapse;margin:0 auto 0 auto;text-align:left;font-family:Helvetica,Arial,Liberation Serif,sans-serif"width=620px><tr style=background-color:#fff><td style="width:100%;padding:30px 7% 15px 7%"><a href=https://fn.lkev.in><img src=https://fn.lkev.in/email/v3/logo-long-allmuted-trasp.png style=width:70%;height:auto;color:#fff alt="FERMI NOTIFY"></a><tr style=background-color:#fff><td><table border=0 cellpadding=0 cellspacing=0 style="width:100%;background-color:#fff;padding:30px 7% 30px 7%;border:none;border-top:1px solid #ddd;border-bottom:1px solid #ddd;font-size:16px"><tr><td><h2 style="margin:10px 0">Benvenut${gender == "M" ? "o" : gender == "F" ? "a" : "ə"} a Fermi Notify!</h2><tr><td style=text-align:left><h4 style=margin-bottom:0>Ciao ${name}!</h4><p style=line-height:1.3;margin-top:10px;margin-bottom:10px>Grazie per esserti registrat${gender == "M" ? "o" : gender == "F" ? "a" : "ə"}, di seguito ci sono alcune indicazioni sul funzionamento di Fermi Notify.<h4 style=margin-bottom:0>Keyword</h4><p style=line-height:1.3;margin-top:10px;margin-bottom:10px>Nella <a href=https://fn.lkev.in/dashboard style="color:#004a77;text-decoration:none;border-bottom:1px solid #004a77"target=_blank>Dashboard</a> potrai inserire le tue <b>keyword</b>, necessarie per trovare le variazioni dell'orario che ti riguardano. Ti invitiamo ad aggiungere le parole che riconducono a te (il tuo cognome, la tua classe, i tuoi corsi, ecc...).<br>Presta attenzione alla <b>formattazione</b> delle keywords, dev'essere uguale a quella scritta nel calendario giornaliero (es. <i>4CIIN</i>, non "4 CIIN" o "4CIN")!<h4 style=margin-bottom:0>Notifiche</h4><p style=line-height:1.3;margin-top:10px;margin-bottom:10px>Vengono inviate notifiche sulle variazioni che contengono le tue keyword tramite email e/o Telegram. Puoi modificare le preferenze sulle notifiche nella <a href=https://fn.lkev.in/dashboard style="color:#004a77;text-decoration:none;border-bottom:1px solid #004a77"target=_blank>Dashboard</a>.<ul style=padding-top:0;line-height:1.3;margin-top:0><li>Se c'è una variazione dell'orario, riceverai una notifica che riassume tutte le variazioni della giornata alle <b>6 del giorno stesso</b>.<li>Se viene pubblicata una variazione dell'orario poche ore prima che si verifichi (es. sostituzione dell'ultimo minuto), verrai notificat${gender == "M" ? "o" : gender == "F" ? "a" : "ə"} <b>all'istante</b>.</ul><p style=margin-top:10px;margin-bottom:10px>Per maggiori informazioni, visita la <a href=https://fn.lkev.in/faq style="color:#004a77;text-decoration:none;border-bottom:1px solid #004a77"target=_blank>FAQ</a>.</table><tr style=background-color:#fff><td style="padding:15px 7% 30px 7%;font-size:13px;position:relative;background-color:#fff"><p style=color:#8b959e>Per supporto o informazioni, consulta la <a href=https://fn.lkev.in/faq style=color:#004a77>FAQ</a> o contattaci su Instagram <a href=https://instagram.com/ferminotify style=color:#004a77><i>@ferminotify</i></a>.</p><a href=https://fn.lkev.in><img src=https://fn.lkev.in/email/v3/icon-allmuted.png style=height:35px;margin-bottom:5px alt="Fermi Notify"></a><p style=margin:0;color:#8b959e><i style=color:#8b959e>Fermi Notify Team</i><p style=margin-top:0><a href=https://fn.lkev.in style=color:#004a77 target=_blank>fn.lkev.in</a><p style=color:#8b959e;font-size:12px>Hai ricevuto questa email perché ti sei registrat${gender == "M" ? "o" : gender == "F" ? "a" : "ə"} a Fermi Notify. Puoi disattivare le notifiche via mail <a href="https://fn.lkev.in/user/unsubscribe?id=${unsub_info.id}&token=${unsub_info.unsub_token}&email=${email}" style="color:#004a77;text-decoration:none;border-bottom:1px solid #004a77"target=_blank>qui</a>.</table></main>`,
		plainText = `Ciao ${name}! Benvenuto a Fermi Notify! Esplora la Dashboard a https://fn.lkev.in/dashboard per personalizzare le notifiche e visita https://fn.lkev.in/faq per scoprire come funziona Fermi Notify.`,
		headers = {
			"List-Unsubscribe": `<mailto:unsubscribe@fn.lkev.in?subject=Unsubscribe%20%3A%28&id=${unsub_info.id}&token=${unsub_info.unsub_token}&email=${email}>, <https://fn.lkev.in/user/unsubscribe?id=${unsub_info.id}&token=${unsub_info.unsub_token}&email=${email}>`
		},
	);
  } catch (err) {
	console.error("ERR WELCOME " + email + ": " + err);
	req.flash("error_msg", `Si è verificato un errore! Riprova più tardi. (${err.message})`);
	return res.redirect("/login");
  }


  const a = await incrementNumberNotification(userId);
  
  req.flash("success_msg", "Account confermato! Fai il login per accedere.");
  res.redirect("/login");
});

app.get("/logout", (req, res, next) => {
  req.logout(function(err){
    if (err) { return next(err); }
  });
  res.redirect("/");
});

app.get("/password_reset", (req, res) => {
  res.render("password_reset.ejs", { isLogged: false });
});

app.get("/credits", (req, res) => {
  res.render("credits.ejs", { isLogged: req.isAuthenticated() });
});

app.get("/feedback", (req, res) => {
  res.render("forms/feedback.ejs", { isLogged: req.isAuthenticated() });
});

app.get("/recruiting", (req, res) => {
  res.render("forms/recruiting.ejs", { isLogged: req.isAuthenticated() });
});

app.get("/source", (req, res) => {
  res.redirect("https://github.com/ferminotify");
});

app.post("/user/request-change-password", async (req, res) => { // PWD-CNG #1
  
  let { user_email } = req.body;

  if(!await userExistsByEmail(user_email)){
    req.flash("error_msg", "Email non registrata!");
    res.redirect("/password_reset");
    return;
  }
  console.log("SUCCESS REQ CHANGE PSW " + user_email);


  let name = await getFirstNameByEmail(user_email);

  const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase(); // 6 char long

  let unsub_info = await getUnsubscribeInfoByEmail(user_email);
  
  pool.query(
    `UPDATE subscribers
      SET secret_temp = $1, secret_temp_timestamp = CURRENT_TIMESTAMP
      WHERE email = $2;`,
    [randomCode, user_email],
    (err, result) => {
      if (err) {
        req.flash("error_msg", "Si è verificato un errore! Riprova più tardi.");
        console.error("ERR REQ CHANGE PSW QUERY " + user_email + ": " + err);
        res.redirect("/password_reset");
        return;
      }
    try{
        sendMail(
          to = user_email,
          subject = `Codice di sicurezza OTP [${randomCode}]`,
          html = `<!doctype html><html><main style="font-family:Helvetica,Arial,Liberation Serif,sans-serif;background-color:#fff;color:#000"><table style="max-width:620px;border-collapse:collapse;margin:0 auto 0 auto;text-align:left;font-family:Helvetica,Arial,Liberation Serif,sans-serif"border=0 cellpadding=0 cellspacing=0 width=620px><tr style=background-color:#fff><td style="width:100%;padding:30px 7% 15px 7%"><a href=https://fn.lkev.in><img src="https://fn.lkev.in/email/v3/logo-long-allmuted-trasp.png" style=width:70%;height:auto;color:#fff alt="FERMI NOTIFY"></a><tr style=background-color:#fff><td><table style="width:100%;background-color:#fff;padding:30px 7% 30px 7%;border:none;border-top:1px solid #ddd;border-bottom:1px solid #ddd;font-size:16px"border=0 cellpadding=0 cellspacing=0><tr><td><h2 style="margin:10px 0">Il tuo codice di sicurezza</h2><tr><td style=text-align:left><p style=margin-bottom:0>Ciao ${name},<p style=line-height:1.3;margin-top:10px;margin-bottom:10px>il tuo <b>codice di sicurezza OTP</b> è:<table style="margin-left:auto;margin-right:auto;padding:5px 0;text-align:center;border-radius:10px"><tr><td><h1 style=margin:0;text-align:center;width:30px;font-size:24px>${randomCode[0]}</h1><td><h1 style=margin:0;text-align:center;width:30px;font-size:24px>${randomCode[1]}</h1><td><h1 style=margin:0;text-align:center;width:30px;font-size:24px>${randomCode[2]}</h1><td><h1 style=margin:0;text-align:center;width:30px;font-size:24px>${randomCode[3]}</h1><td><h1 style=margin:0;text-align:center;width:30px;font-size:24px>${randomCode[4]}</h1><td><h1 style=margin:0;text-align:center;width:30px;font-size:24px>${randomCode[5]}</h1></table><tr><td style=font-size:13px;text-align:center><p style=margin-bottom:15px>Il codice scadrà tra <b>15 minuti</b>.<br>Ti inviamo questo codice perché hai richiesto di cambiare la password del tuo account. Se non hai richiesto di cambiare la password, puoi ignorare questa email.</table><tr style=background-color:#fff><td style="padding:15px 7% 30px 7%;font-size:13px;position:relative;background-color:#fff"><p style=color:#8b959e>Per supporto o informazioni, consulta la <a href=https://fn.lkev.in/faq style=color:#004a77>FAQ</a> o contattaci su Instagram <a href=https://instagram.com/ferminotify style=color:#004a77><i>@ferminotify</i></a>.</p><a href=https://fn.lkev.in><img src="https://fn.lkev.in/email/v3/icon-allmuted.png" style=height:35px;margin-bottom:5px></a><p style=margin:0;color:#8b959e><i style=color:#8b959e>Fermi Notify Team</i><p style=margin-top:0><a href=https://fn.lkev.in style=color:#004a77 target=_blank>fn.lkev.in</a><p style=color:#8b959e;font-size:12px>Hai ricevuto questa email perché ti sei registrato a Fermi Notify. Puoi disattivare le notifiche via mail <a href="https://fn.lkev.in/user/unsubscribe?id=${unsub_info.id}&token=${unsub_info.unsub_token}&email=${user_email}" style=color:#004a77>qui</a>.</table></main><html>`,
          plainText =  `Il tuo codice di sicurezza OTP è: ${randomCode}. Il codice scadrà tra 15 minuti. Ti inviamo questo codice perché hai richiesto di cambiare la password del tuo account. Se non hai richiesto di cambiare la password, puoi ignorare questa email.`,
		  headers = {}
        )
		console.log('SUCCESS REQ CHANGE PSW EMAIL SENT TO ' + user_email);
		res.render("password_otp.ejs", { 
			isLogged: false,
			user_email: user_email
		});
    } catch (err) {
      console.error("ERR REQ CHANGE PSW SENDMAIL " + user_email + ": " + err);
      req.flash("error_msg", "Si è verificato un errore! Riprova più tardi.");
      res.redirect("/password_reset");
    }
  });

});

app.post("/user/otp-change-password", async (req, res) => { // PWD-CNG #2
  let { user_email, random_code } = req.body;

  let errors = [];

  pool.query(
    `SELECT * FROM subscribers
      WHERE email = $1;`,
    [user_email],
    async (err, results) => {
      if (err) {
        console.error("ERR OTP CHANGE PSW " + user_email + " " + random_code + ": " + err);
      }

      let codeGenerationTimestamp = results.rows[0].secret_temp_timestamp;      
      const timestamp = new Date(codeGenerationTimestamp);
      // Date.UTC bc the db is in the UTC timezone
      const now = new Date();
      const currentTime = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
      const timeDifference = currentTime.getTime() - timestamp.getTime();
      const fifteenMinutesInMilliseconds = 15 * 60 * 1000;

      if (timeDifference > fifteenMinutesInMilliseconds) {
        req.flash("error_msg", "Il codice OTP è scaduto!");
        console.error("ERR OTP CHANGE PSW EXPIRED " + user_email + "; input: " + random_code + "; random_code: " + results.rows[0].secret_temp);
        res.redirect("/password_reset");
        return;
      }

      if (results.rows[0].secret_temp == random_code) { // Password change
        return res.render("password_new.ejs", { 
          random_code,
          isLogged: false,
          user_email: user_email
        });
      } else {
        console.warn("WARN OTP CHANGE PSW NOT CORRECT " + user_email + "; input: " + random_code + "; random_code: " + results.rows[0].secret_temp);
        errors.push({ message: "Il codice OTP non corrisponde!" });
        res.render("password_otp.ejs", { errors, user_email, isLogged : false});
      }
    }
  );
});

app.post("/user/new-change-password", async (req, res) => { // PWD-CNG #3
  let { password, password2, user_email, random_code } = req.body;

  let errors = [];
  
  if(!await userEmailMatchesOTP(user_email, random_code)){
    console.warn("WARN NEW PASSWORD " + user_email + ": OTP not valid");
    errors.push({ message: "Il codice OTP è corretto." });
    res.render("password_otp.ejs", { errors, user_email, isLogged : false});
    return;
  }
  
  if (password != password2) {
    errors.push({ message: "Le password non corrispondono!" });
  }

  if (password.length < 6) {
    errors.push({ message: "La password deve essere lunga almeno 6 caratteri!" });
  }

  if (errors.length > 0) {
    req.flash("error_msg", errors);
    res.redirect("/password_reset");
    return;
  }

  hashedPassword = await bcrypt.hash(password, 10);

  pool.query(
    `UPDATE subscribers
      SET password = $1, secret_temp = '', secret_temp_timestamp = NULL
      WHERE email = $2;`,
    [hashedPassword, user_email],
    (err, results) => {
      if (err) {
        errors.push({ message: "Si è verificato un errore! Riprova più tardi." });
        console.error("ERR NEW PASSWORD " + user_email + ": " + err);
        req.flash("error_msg", errors);
        res.redirect("/password_reset");
      }else{
        console.log("SUCCESS NEW PASSWORD " + user_email);
        req.flash("success_msg", "Password cambiata con successo!");
        res.redirect("/login");
      }
    }
  );

});

app.post("/user/notification-time", async (req, res) => {

  let time = req.body.time;
  let day = req.body.day

  try{
    await pool.query(
    `UPDATE subscribers
      SET notification_time = $1, notification_day_before = $2
      WHERE email = $3;`,
    [time, day, req.user.email]);

    console.log("SUCCESS EDIT NOTIFICATION TIME " + req.user.email + ": " + time + " - day before " + day);
    res.status(200).json({ message: "Modifiche applicate con successo!" });

  } catch (error) {
    console.error("ERR NOTIFICATION TIME " + req.user.email + ": " + error);
    res.status(400).json({ message: "Si è verificato un errore! Riprova più tardi." });
  }
  
});

app.post("/user/notification-preferences", async (req, res) => {
  let option;

  // I use not true because sometimes value can be also None 
  // or undefined
  if(req.body.email && req.body.telegram)
    option = 3;
  else if(req.body.email && !req.body.telegram)
    option = 2;
  else if(!req.body.email && req.body.telegram) 
    option = 1;
  else if(!req.body.email && !req.body.telegram) 
    option = 0;

  pool.query(
    `UPDATE subscribers
      SET notification_preferences = $1
      WHERE email = $2;`,
    [option, req.user.email],
    (err, results) => {
      if (err) {
        console.error("ERR NOTIFICATION PREF" + req.body.email + ": " + err);
        res.status(400).json({ message: "Si è verificato un errore! Riprova più tardi." });
        throw err;
      }
    }
  );
  res.status(200).json({ message: "Modifiche applicate con successo!" });
});

app.post("/user/keyword", async function (req, res) {
  /**
   * If the keyword has already been stored,
   * has to be removed.
   * If the keyword is not stored yet,
   * has to be appended.
   */
  let sentKeyword = req.body.keyword;
  let userKeywords = await getUserKeywordsByEmail(req.user.email);

  sentKeyword = sentKeyword.trim(); // remove spaces from start, end
  sentKeyword = sentKeyword.toUpperCase(); // set all to uppercase

  let occurrences = 0;
  if(userKeywords != null){
    userKeywords.forEach(kw => {
      if(kw==sentKeyword) {
        occurrences=occurrences+1;
      }
    });
  }

  if(occurrences>0){
    pool.query(
      `UPDATE subscribers
        SET tags = array_remove(tags, $1)
        WHERE email = $2;`,
      [sentKeyword, req.user.email],
      (err, results) => {
        if (err) {
          console.error("ERR DEL KW " + req.user.email + ": " + err);
          res.status(400).json({ message: "Si è verificato un errore! Riprova più tardi." });
          throw err;
        }
      }
    );
  } else {
    pool.query(
      `UPDATE subscribers
        SET tags = array_append(tags, $1)
        WHERE email = $2;`,
      [sentKeyword, req.user.email],
      (err, results) => {
        if (err) {
          console.error("ERR ADD KW " + req.user.email + ": " + err);
          res.status(400).json({ message: "Si è verificato un errore! Riprova più tardi." });
          throw err;
        }
      }
    );
  }

  res.redirect("/dashboard");
});

app.post("/user/edit", async function (req, res) {
  try { var email = req.user.email; } catch (error) { console.error("ERR EDIT: " + error); return res.status(400).json({ message: "Si è verificato un errore! Riprova più tardi." }); }
  var name = req.body.firstname || await getFirstNameByEmail(email);
  var surname = req.body.lastname || await getLastNameByEmail(email);
  var gender = req.body.gender !== undefined && req.body.gender.length === 1 ? req.body.gender : await getGenderByEmail(email);

  name = name.trim();
  surname = surname.trim();

  if(name.length > 50 || surname.length > 50) {
    console.warn("WARN EDIT " + email + ": name or surname too long");
    return res.status(400).json({ message: "Il nome o il cognome è troppo lungo!" });
  }

  try {
    await pool.query(
      `UPDATE subscribers
      SET name = $1, surname = $2, gender = $3
      WHERE email = $4`,
      [name, surname, gender, email]
    );

    console.log(`SUCCESS EDIT ${email}: new firstname = ${name}; new lastname = ${surname}; new gender = ${gender}`);
    return res.status(200).json({ message: "Modifiche salvate con successo!" });
  } catch (error) {
    console.error('ERR EDIT' + email + ": " + error);
    return res.status(400).json({ message: "Si è verificato un errore! Riprova più tardi." });
  }
});

app.get("/user/unsubscribe", async (req, res) => {
  // get email, id and token
  let email = req.query.email;
  let id = req.query.id;
  let token = req.query.token;

  // get user info
  let userInfo = await getUnsubscribeInfoByEmail(email);
  if(userInfo == null){
    console.warn("WARN UNSUBSCRIBE " + email + ": user not found");
    req.flash("error_msg", "Utente non trovato!");
    return res.redirect("/login");
  }

  // check if id and token are correct
  if(userInfo.id != id || userInfo.unsub_token != token){
    console.warn("WARN UNSUBSCRIBE " + email + ": id or token not valid");
    req.flash("error_msg", "ID o token non valido!");
    return res.redirect("/login");
  }

  if(userInfo.notification_preferences == 0){
    console.warn("WARN UNSUBSCRIBE " + email + ": already unsubscribed");
    return res.redirect("/login");
  }

  // update notification preferences
  if(userInfo.notification_preferences == 2){
    pool.query(
      `UPDATE subscribers
        SET notification_preferences = 0
        WHERE email = $1`,
      [email],
      (err, results) => {
        if (err) {
          console.error("ERR UNSUBSCRIBE [1] " + email + ": " + err);
          req.flash("error_msg", "Si è verificato un errore! Riprova più tardi.");
          return res.redirect("/login");
        }
      }
    );
  } else if(userInfo.notification_preferences == 3){
    pool.query(
      `UPDATE subscribers
        SET notification_preferences = 1
        WHERE email = $1`,
      [email],
      (err, results) => {
        if (err) {
          console.error("ERR UNSUBSCRIBE [2] " + email + ": " + err);
          req.flash("error_msg", "Si è verificato un errore! Riprova più tardi.");
          return res.redirect("/login");
        }
      }
    );
  }

  console.log("SUCCESS UNSUBSCRIBE " + email);
  req.flash("success_msg", "Disiscrizione dalle email effettuata con successo!");
  return res.redirect("/");
});

// get domain status
app.get("/status", async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.send("OK👍");
});

// analytics - save to db searched keywords in filtraEventi
app.post("/api/analytics/searched-keywords-filtraEventi", async (req, res) => {
  let keywords = req.body.keyword.split(", ");
  keywords = keywords.filter(kw => kw.length <= 100);
  let user_email = req.body.user_email.trim() !== "" && req.body.user_email.length <= 100 ? req.body.user_email : null;
  keywords.forEach(async kw => {
    try {
      await pool.query(
        `INSERT INTO filtra_eventi_kw (email, keyword, timestamp)
          VALUES ($1, $2, CURRENT_TIMESTAMP)`,
        [user_email, kw]
      );
    } catch (error) {
      console.error("ERR ANALYTICS SEARCHED KEYWORDS FILTRAEVENTI " + kw + ": " + error);
    }
  });
});

// Azure main
async function sendMail(to, subject, html, plainText, headers = {}) {
  const POLLER_WAIT_TIME = 10;
  try {

    const message = {
      senderAddress: "<donotreply@fn.lkev.in>",
      // sender name

      content: {
        subject: subject,
        html: html,
        plainText: plainText
      },
      recipients: {
        to: [
          {
            address: to,
          },
        ],
      },
      headers: headers
    };
	
    const poller = await EmailCl.beginSend(message);

    if (!poller.getOperationState().isStarted) {
      throw "ERR Poller was not started."
    }

    //let timeElapsed = 0;
    while(!poller.isDone()) {
      poller.poll();
      console.log("INFO Email send polling in progress");

      await new Promise(resolve => setTimeout(resolve, POLLER_WAIT_TIME * 1000));
      //timeElapsed += 10;

      /*if(timeElapsed > 18 * POLLER_WAIT_TIME) {
        throw "ERR Polling timed out.";
      }*/
    }

    if(poller.getResult().status === "Succeeded") {
      console.log(`SUCCESS sent email (operation id: ${poller.getResult().id}) to ${to}`);
    } else {
      throw "ERR" + poller.getResult().error;
    }
  } catch (e) {
    throw "ERR" + e;
  }
}

// get unsubscribe from email info
async function getUnsubscribeInfoByEmail(email){
  try {
    const RES = await pool.query(
      `SELECT id, unsub_token, notification_preferences FROM subscribers
        WHERE email = '${email}'`,
    )
    return RES.rows[0];
  } catch (err) {
    return null;
  }
}

// user instead of email so that it does not have to pass user.email which may result in undefined error
async function getFirstNameByUser(user){
  if(!user) return null;
  try {
    const RES = await pool.query(
      `SELECT name FROM subscribers
        WHERE email = '${user.email}'`,
    );
    return RES.rows[0].name;
  } catch (err) {
    console.error("ERR GET USER NAME BY USER " + user.email + ": " + err.stack);
  }
}

async function getFirstNameByEmail(email){
  try{
    const RES = await pool.query(
      `SELECT name FROM subscribers
        WHERE email = '${email}'`,
    );
    return RES.rows[0].name;
  } catch (err) {
    console.error("ERR GET USER NAME BY EMAIL " + email + ": " + err.stack);
  }
}

async function getLastNameByEmail(email){
  try{
    const RES = await pool.query(
      `SELECT surname FROM subscribers
        WHERE email = '${email}'`,
    );
    return RES.rows[0].surname;
  } catch (err) {
    console.error("ERR GET USER LASTNAME BY EMAIL " + email + ": " + err.stack);
  }
}

async function getGenderByEmail(email){
  try {
    const RES = await pool.query(
      `SELECT gender FROM subscribers
        WHERE email = '${email}'`,
    );
    return RES.rows[0].gender;
  } catch (err) {
    console.error("ERR GET USER GENDER BY EMAIL " + email + ": " + err.stack);
  }
}

async function getInfoByUser(user){
  if(!user) return null;
  try {
    const RES = await pool.query(
      `SELECT * FROM subscribers
        WHERE email = '${user.email}'`,
    );
    return RES.rows[0];
  } catch (err) {
    console.error("ERR GET USER INFO " + user.email + ": " + err.stack);
  }
}

async function userExistsByEmail(email){
  try {
    const RES = await pool.query(
      `SELECT * FROM subscribers
        WHERE email = '${email}'`,
    );
    return RES.rows.length > 0;
  } catch (err) {
    console.error("ERR USER EXISTS BY EMAIL " + email + ": " + err.stack);
  }
}

async function userEmailMatchesOTP(email, otp){
  try {
    const RES = await pool.query(
      `SELECT * FROM subscribers
        WHERE email = '${email}' AND secret_temp = '${otp}'`,
    );
    return RES.rows.length > 0;
  } catch (err) {
    console.error("ERR USER EMAIL MATCHES OTP " + email + ": " + err.stack);
  }
}

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect("/dashboard");
  }
  next();
}

function checkNotAuthenticated(req, res, next) {
  if (!req.isAuthenticated()) {
    // User is NOT authenticated, save the intended URL and redirect to login
    const url = new URL(req.originalUrl, `http://${req.headers.host}`);
    req.session.returnTo = url.href;
    return res.redirect("/login");
  }
  // User is authenticated, proceed to the next middleware or route
  next();
}

async function getUserEmailWithTelegramID(telegramId) {
  try {
    const RES = await pool.query(
      `SELECT email FROM subscribers
        WHERE telegram = '${telegramId}'`,
    );
    return RES.rows[0].email;
  } catch (err) {
    console.error("ERR GET EMAIL WITH TG ID " + telegramId + ": " + err.stack);
  }
}

async function getNumberNotification(email){
  try{
    const RES = await pool.query(
      `SELECT notifications FROM subscribers
        WHERE email = '${email}'`,
    );
    return RES.rows[0].notifications;
  } catch (err) {
    console.error("ERR GET NUMBER NOTIFICATIONS " + email + ": " + err.stack);
  }
}

async function incrementNumberNotification(telegramId){
  try {
    const RES = await pool.query(
      `UPDATE subscribers
         SET notifications = notifications + 1
       WHERE telegram = '${telegramId}' AND notifications = -1;`
    );
    console.log("SUCCESS CONFIRMATION TG ID: " + telegramId);
    return RES;
  } catch (err) {
    console.error("ERR ADD NOTIFICATIONS " + telegramId + ": " + err.stack);
  }
}

async function getTelegramTemporaryCode() {
  /**
   * This function returns the code that
   * the user has to send to telegram bot.
   * 
   * When the bot get this code, register the 
   * telegram user id of the sender (my user).
   * 
   * This code is unique for every subscriber,
   * is generated with a $ at its beginning
   * and parts of the hashed email of the user.
   */
  let code = "X";

  code += (Math.random() + 1).toString(36).substring(6); // add random string of 7 char

  /**
   * VALIDATING CODE
   * Check if the code generated
   * is not yet associated with someone else.
   */
  allCodes = await getAllTelegram();
  if (allCodes != undefined){
    for(let i=0; i<allCodes.length;i++){
      if(allCodes[i] == code) {
        return getTelegramTemporaryCode();
      }
    }
  }
  return code;
}

async function getAllTelegram() {
  try {
    const RES = await pool.query(
      `SELECT telegram FROM subscribers;`
    );
    return RES.rows[0].telegram;
  } catch (err) {
    console.error(err.stack);
  }
}

async function getUserKeywordsByEmail(user_email){
  try {
    const RES = await pool.query(
      `SELECT tags FROM subscribers
        WHERE email = '${user_email}'`,
    );
    return RES.rows[0].tags;
  } catch (err) {
    console.error("ERR GET KW " + user_email + ": " + err.stack);
  }
}

/* set static folder for css etc */
app.use(express.static(path.join(__dirname, 'public')));

/* set up 404 page (not found) */
/* WARNING: This route has to be the last one!! */
//The 404 Route (ALWAYS Keep this as the last route)
app.get('*', function(req, res){
  res.render("404.ejs", { isLogged: req.isAuthenticated() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});