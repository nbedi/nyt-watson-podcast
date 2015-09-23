var watson = require('watson-developer-cloud');
var fs = require('fs');
var request = require('request');
var nyt = 'http://www.nytimes.com/pages/nytnow/nytnow-email/';
var watson_params = require('./watson-params.json');
var jsxml = require("node-jsxml");
var exec = require('child_process').exec;

var text_to_speech = watson.text_to_speech(watson_params);

var d = new Date();
var days = ["monday", "tuesday", "wednesday", "thursday", "friday"];
var day = days[d.getDay()-1];

request(nyt, function (error, response, body) {
  if (!error && response.statusCode == 200) {
    
    var transcript = body.substring(body.indexOf('class="large-headline"')+23, body.length);
    transcript = transcript.substring(0, transcript.indexOf("</tbody>"));
    
    // im not great with regex
    transcript = transcript.replace(/<tr>/g, "thereisnowaytheywillhavethistext")
                    .replace(/<(?:.|\n)*?>/gm, '')
                    .replace(/&bull;/g, "<split><break time='1s'/>")
                    .replace(/&\S*;/g, '')      
                    .replace(/\n\s*\n/g, '')
                    .replace(/thereisnowaytheywillhavethistext/g, "<break time='1s'/>");

    var transcriptArray = transcript.split("<split>");
    var soxString = "";
    transcriptArray.forEach(function(d,i) {
        var params = {
          text: d,
          voice: 'en-US_LisaVoice', // Optional voice 
          accept: 'audio/wav'
        };
         
        // Pipe the synthesized text to a file 
        text_to_speech.synthesize(params).pipe(fs.createWriteStream('output'+i+'.wav'));
        soxString += "output" + i + ".wav ";
    });
    var child1 = exec('sox '+ soxString +' output.wav',
      function (error, stdout, stderr) {
        if (error !== null) {
          console.log('exec error: ' + error);
        } else {
          var child2 = exec('afconvert -d alac output.wav '+ day +'.m4a',
            function (error, stdout, stderr) {
              if (error !== null) {
                console.log('exec error: ' + error);
              }
            });              
        }
    });
  }
});
