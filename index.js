var watson = require('watson-developer-cloud');
var fs = require('fs');
var request = require('request');
var nyt = 'http://www.nytimes.com/pages/nytnow/nytnow-email/';
var watson_params = require('./watson-params.json');
var libxml = require("libxmljs");
var exec = require('child_process').exec;

// var text_to_speech = watson.text_to_speech(watson_params);
// 
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
              } else {
                generateXml();
              }
            });              
        }
    });
  }
});

function generateXml() {
    fs.readFile('./feed.xml', 'utf8', function (err,data) {
    if (err) {
      return console.log(err);
    }
    var duration = 600;
    var afinfo = exec('afinfo -r output.wav',
      function (error, stdout, stderr) {
        if (error !== null) {
          console.log('exec error: ' + error);
        } else {
          duration = Math.ceil(parseInt(
                      stdout.substring(stdout.indexOf("estimated duration: ")+20, 
                                        stdout.indexOf(" sec"))));
    
      console.log(duration);
      var stats = fs.statSync("output.wav");
      var filesize = stats["size"];
      
      var xmlDoc = libxml.parseXmlString(data, { noblanks: true });
      var item = xmlDoc.get('//item').remove();
      xmlDoc.get('//channel')
            .node('item')
              .node('title', d.toUTCString().substring(0,16))
            .parent()
              .node('itunes:author', 'NY Times')
            .parent()
              .node('itunes:summary', 'The New York Times morning briefing read by Lisa from IBM Watson')
            .parent()
              .node('enclosure')
                .attr({
                  url: 'http://neilbedi.com/nyt-watson-podcast/'+day+'.mp3',
                  length: filesize,
                  type: 'audio/x-m4a'
                })
            .parent()
              .node('guid', 'http://neilbedi.com/nyt-watson-podcast/'+day+'.mp3')
            .parent()
              .node('pubDate', d.toUTCString())
            .parent()
              .node('itunes:duration', duration.toString());
            
      fs.writeFile("feed.xml", xmlDoc.toString(), function(err) {
        if(err) {
          return console.log(err);
        }
        console.log("xml generated");
      });
    }
    }); 
  });
}
