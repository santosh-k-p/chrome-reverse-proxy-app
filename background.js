chrome.app.runtime.onLaunched.addListener(function() {
	WSC ={};
    chrome.app.window.create('window.html', {
      'outerBounds': {
        'width': 600,
        'height': 400
      }
    });
  });
var launch = function launch(){
    console.log()
}
  //chrome.app.runtime.onLaunched.addListener(launch);