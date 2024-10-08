// THEME

localStorage.getItem("theme") == "light" ? document.getElementById("themeCSS").setAttribute("href", "/css/light.css") : document.getElementById("themeCSS").setAttribute("href", "/css/dark.css");

function changeTheme(){
	var theme = document.getElementById("themeCSS");
	if(theme.getAttribute("href") == "/css/dark.css"){
		theme.setAttribute("href", "/css/light.css");
		document.getElementsByClassName("sidebar-theme-btn")[0].innerHTML = "dark_mode";
		localStorage.setItem("theme", "light");
	} else {
		theme.setAttribute("href", "/css/dark.css");
		document.getElementsByClassName("sidebar-theme-btn")[0].innerHTML = "light_mode";
		localStorage.setItem("theme", "dark");
	}
}