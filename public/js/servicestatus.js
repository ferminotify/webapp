// check service status
// db
function fetchWithRetries(url, retries = 3) {
    let attempt = 1;

    function attemptFetch() {
        fetch(url)
            .then(res => {
                if (!res.ok) {
                    throw new Error('Network response was not ok');
                }
                return res.json();
            })
            .then(data => {
                console.log("db: " + data.status + " - attempt: " + attempt);
                if (data.status === "error") {
					// click on other .errorbanner
					try{
						document.querySelector(".errorbanner").click();
					} catch (e) {}
					if(attempt >= retries) {
						generateError("error", `Possibili problemi con la connessione al database dopo ${retries} tentativi.`);
					} else {
                    	generateError("error", `Possibili problemi con la connessione al database. Tentativo ${attempt}.`);
						attempt++;
						attemptFetch();
					}
                }
            })
            .catch(err => {
                console.error(`Fetch error on attempt ${attempt}:`, err);
                if (attempt < retries) {
                    attempt++;
                    attemptFetch();
                } else {
                    generateError("error", `Possibili problemi con la connessione al database dopo ${retries} tentativi.`);
                }
            });
    }

    attemptFetch();
}

// Call the function with the URL
fetchWithRetries("https://status.fn.lkev.in/db/get/status");