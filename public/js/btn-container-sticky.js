var stickyContainer = $(".btn-container");
var stickyOffset = stickyContainer.offset().top;

$(window).on('scroll', function(){
	if ($(window).scrollTop() >= stickyOffset) {
		stickyContainer.addClass("sticked");
	} else {
		stickyContainer.removeClass("sticked");
	}
});