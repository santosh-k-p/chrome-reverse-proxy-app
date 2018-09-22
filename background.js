chrome.app.runtime.onLaunched.addListener(function() {
	WSC ={};
    chrome.app.window.create('window.html', {
      'outerBounds': {
        'width': 400,
        'height': 500
      }
    });
  });
var launch = function launch(){
    console.log()
}
  //chrome.app.runtime.onLaunched.addListener(launch);