function loading(n){
	var submitBtn = document.getElementsByClassName("submit-btn")[n];
	var width = window.getComputedStyle(submitBtn).getPropertyValue('width');
	var height = window.getComputedStyle(submitBtn).getPropertyValue('height');
	submitBtn.style.width = width;
	submitBtn.style.height = height;
	//submitBtn.innerHTML = "<img src='/IMG/loading.png' class='submit-loading rotate-loading'>";
	submitBtn.innerHTML = "<div class='submit-lds-grid'><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>";
}

function resetLoading(n, params){
	var submitBtn = document.getElementsByClassName("submit-btn")[n];
	submitBtn.style.width = params.width;
	submitBtn.style.height = params.height;
	submitBtn.innerHTML = params.html;
}

function saveBtnParams(n){
	var submitBtn = document.getElementsByClassName("submit-btn")[n];
	var html = submitBtn.innerHTML;
	var width = submitBtn.style.width;
	var height = submitBtn.style.height;
	return {html: html, width: width, height: height};
}