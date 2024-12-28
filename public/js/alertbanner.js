/*
<div id="alertbanner-{id}" class="alertbanner errorbanner or successbanner">
	<p id="alertmessage"><i class="fa-solid fa-circle-exclamation or fa-check"></i> err</p>
</div>
<script>
	document.getElementById("alertbanner-{id}").style.animation = "showAlert 0.5s ease-in-out forwards";
	document.getElementById("alertbanner-{id}").addEventListener("click", function() {
		document.getElementById("alertbanner-{id}").style.animation = "hideAlert 0.5s ease-in-out forwards";
	});
</script>
*/
class AlertBanner{
	constructor(type, msg){
		// create the alert banner
		this.html = document.createElement('div');
		// get all .alertbanner elements
		let alertbanners = document.getElementsByClassName('alertbanner');
		// set the id of the alert banner
		this.html.id = 'alertbanner-' + alertbanners.length;
		// set the class of the alert banner
		this.html.classList.add('alertbanner');
		// set the type of the alert banner
		this.html.classList.add(type + 'banner');
		// create the alert message
		let message = document.createElement('p');
		// set the id of the alert message
		message.id = 'alertmessage';
		// set the text of the alert message
		let msg_str = '<i class="fa-solid ';
		msg_str += type == 'error' ? 'fa-circle-exclamation' : 'fa-check';
		msg_str += '"></i> ' + msg;
		message.innerHTML = msg_str;
		// append the alert message to the alert banner
		this.html.appendChild(message);
		// append the alert banner to the body
		document.body.appendChild(this.html);
		// set the animation of the alert banner
		this.html.style.animation = 'showAlert 0.5s ease-in-out forwards';
		// add an event listener to the alert banner
		this.html.addEventListener('click', function(){
			// set the animation of the alert banner
			this.style.animation = 'hideAlert 0.5s ease-in-out forwards';
		});
	}
	show(){
		document.body.appendChild(this.html);
	}
}