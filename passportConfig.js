const LocalStrategy = require("passport-local").Strategy;
const { pool } = require("./dbConfig");
const bcrypt = require("bcrypt");

function initialize(passport) {
  console.log("Initialized");

  const authenticateUser = (email, password, done) => {
    pool.query(
      `SELECT * FROM subscribers WHERE email = $1`,
      [email],
      (err, results) => {
        if (err) {
          console.error("ERR PASSPORT DATABASE QUERY:", err);
          return done(null, false, { message: "Si è verificato un errore nella connessione al database. Riprova più tardi." });
        }

        if (results.rows.length > 0) {
          const user = results.rows[0];

          /**
           * Check if the user has confirmated its email. 
           * When the email is not yet confirmed its number
           * of notifications is negative, otherwise is positive
           */
          if (user.notifications < 0) {
            return done(null, false, { message: "Ti abbiamo inviato una mail per confermare l'account! (controlla anche lo SPAM)", confirm: false });
          }

          // Check for the password match
          bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
              console.error("ERR PASSPORT PSW COMPARE: ", err);
              return done(null, false, { message: "Si è verificato un errore nella verifica della password. Riprova più tardi." });
            }

            if (isMatch) {
              return done(null, user);
            } else {
              return done(null, false, { message: "La password è scorretta." });
            }
          });
        } else {
          // No user
          return done(null, false, {
            message: "Non sono registrati utenti con le email " + email + "."
          });
        }
      }
    );
  };

  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      authenticateUser
    )
  );
  // Stores user details inside session. serializeUser determines which data of the user
  // object should be stored in the session. The result of the serializeUser method is attached
  // to the session as req.session.passport.user = {}. Here for instance, it would be (as we provide
  //   the user id as the key) req.session.passport.user = {id: 'xyz'}
  passport.serializeUser((user, done) => done(null, user.id));

  // In deserializeUser that key is matched with the in memory array / database or any data resource.
  // The fetched object is attached to the request object as req.user

  passport.deserializeUser((id, done) => {
    pool.query(`SELECT * FROM subscribers WHERE id = $1`, [id], (err, results) => {
      if (err) {
        console.error("ERR PASSPORT Database query error during deserialization:", err); // Log the error
        return done(err);
      }
      return done(null, results.rows[0]);
    });
  });
}

module.exports = initialize;
