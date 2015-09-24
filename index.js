var watson = require('watson-developer-cloud');
var fs = require('fs');
var request = require('request');
var nyt = 'http://www.nytimes.com/pages/nytnow/nytnow-email/';
var watson_params = require('./watson-params.json');
var libxml = require("libxmljs");
var exec = require('child_process').exec;
var CronJob = require('cron').CronJob;

var job = new CronJob('00 30 6 * * 1-5', function(){
    /*
     * Runs every weekday (Monday through Friday)
     * at 06:30:00 AM. 
     */
    var text_to_speech = watson.text_to_speech(watson_params);

    var d = new Date();
    var days = ["monday", "tuesday", "wednesday", "thursday", "friday"];
    var day = days[d.getDay()-1];
    var soxString = "";

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
        transcriptArray.forEach(function(d,i) {
            var params = {
              text: d,
              voice: 'en-US_LisaVoice', // Optional voice 
              accept: 'audio/wav'
            };
             
            // Pipe the synthesized text to a file 
            var wavStream = fs.createWriteStream('output'+i+'.wav');
            wavStream.on('close', function() {
              appendWav(transcriptArray.length);
            });
            text_to_speech.synthesize(params).pipe(wavStream);
            soxString += "output" + i + ".wav ";
        });
      }
    });

    var wavCount = 0;
    function appendWav(itemCount) {
      wavCount++;
      if (wavCount == itemCount) {
        var child1 = exec('sox '+ soxString +' output.wav',
          function (error, stdout, stderr) {
            if (error !== null) {
              console.log('exec error: ' + error);
            } else {
              var child2 = exec('ffmpeg -i output.wav '+ day +'.m4a',
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
    }

    function generateXml() {
        fs.readFile('./feed.xml', 'utf8', function (err,data) {
        if (err) {
          return console.log(err);
        }
        var duration = "";
        var ffmpeg = exec('ffmpeg -i output.wav -f null /dev/null',
          function (error, stdout, stderr) {
            if (error !== null) {
              console.log('exec error: ' + error);
            } else {
              duration = stderr.substring(stderr.indexOf("Duration: ")+10, stderr.length)
                                .substring(0, 8);
        
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
                      url: 'http://nwp.neilbedi.com/'+day+'.m4a',
                      length: filesize,
                      type: 'audio/x-m4a'
                    })
                .parent()
                  .node('guid', 'http://nwp.neilbedi.com/'+day+'.m4a')
                .parent()
                  .node('pubDate', d.toUTCString())
                .parent()
                  .node('itunes:duration', duration);
                
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
  },
  null,
  true /* Start the job right now */,
  "America/New_York" /* Time zone of this job. */
);
