var request = require('request');
var fs = require('fs');
var cheerio = require('cheerio');
var express = require('express');
var events = require('events');

var localData = require("./data.json");
var domains = localData.domains;

var oldAddress = "";

var app = express();
app.set("view engine", "jade");
app.use(express.static("static"));
app.get("/", function (req, res) {
  res.render("domains", {domains:domains});
});

app.get("/refresh", function (req, res) {
  checkDomains();
});

app.get("/domain/:id", function (req, res) {
  res.render("subdomains", {domain:domains[req.params.id].link, subdomains: domains[req.params.id].subdomains});
});

function checkDomains() {
  var token = "";
  var modifyFlag = false;
  request({uri:"https://my.freenom.com/clientarea.php?action=domains", jar:true}, function (err, res, data) {
    $ = cheerio.load(data);
    $("#bulkactionform table tbody tr").each(function (idx, $domain) {
      var domain = {};
      domain.link = $("a", $domain).first().text().trim();
      domain.id = $("a", $domain).last().attr("href").match(".+id=([0-9]+)")[1];
      domain.subdomains = [];
      domains[domain.id] = domain;
      request({uri: "https://my.freenom.com/clientarea.php",qs:{managedns:domain.link,domainid:domain.id}, jar:true}, function (err, res, data) {
        $ = cheerio.load(data);
        token = $("[name='token']").val();
        $("form").first().find("table tbody tr").each(function (idx, $subdomain) {
          var subdomain = {};
          subdomain.name = $("td:nth-of-type(1) input[type='text']", $subdomain).val();
          subdomain.type = $("td:nth-of-type(2) strong", $subdomain).text();
          subdomain.ttl = $("td:nth-of-type(3) input[type='text']", $subdomain).val();
          subdomain.value = $("td:nth-of-type(4) input[type='text']", $subdomain).val();
          if(subdomain.value == oldAddress){
            modifyFlag = true;
            subdomain.value = localData.IPAddress;
          }
          domains[domain.id].subdomains.push(subdomain);
        });
        if(modifyFlag){
          var formData = {token:token, dnsaction:"modify", records:[]};
          for (subdomain of domains[domain.id].subdomains) {
            subdomain.line = "";
            formData.records.push(subdomain);
          }
          request.post({uri:"https://my.freenom.com/clientarea.php", qs:{managedns:domain.link,domainid:domain.id}, jar:true, form:formData}, function (err, res, data) {
            if(err==null){
              console.log("Records updated");
              checkDomains();
            }
          });
        }
      });
    });
  });
}

function checkIP() {
  request.post("http://192.168.1.1/sysbus/NMC:getWANStatus", {"parameters":{}}, function (err, res, data) {
    if(JSON.parse(data).data.IPAddress!=localData.IPAddress){
      oldAddress = localData.IPAddress;
      localData.IPAddress = JSON.parse(data).data.IPAddress;
      saveConfig();
      request.post({uri:"https://my.freenom.com/dologin.php", jar:true, form:{"username":localData.mail, password:localData.password}}, function (err, res, data) {
        if(err==null){
          checkDomains();
        }
      });
    }
  });
}

function saveConfig() {
  fs.writeFileSync("./data.json", JSON.stringify(localData));
}

var server = app.listen(localData.port,function () {
  checkIP();
});

/*
To get token:
$([name='token'])[0].value
*/

/*
To add a subdomain:
token:c2d7bbe16d14dae53bf9b931d746361f7e1d5f21
dnsaction:add
addrecord[0][name]:ft
addrecord[0][type]:CNAME
addrecord[0][ttl]:14440
addrecord[0][value]:farrentether.fr.nf
addrecord[0][priority]:
addrecord[0][port]:
addrecord[0][weight]:
addrecord[0][forward_type]:1
*/

/*
To modify a subdomain:
token:c2d7bbe16d14dae53bf9b931d746361f7e1d5f21
dnsaction:modify
records[0][line]:
records[0][type]:A
records[0][name]:
records[0][ttl]:300
records[0][value]:90.61.137.171
records[1][line]:
records[1][type]:A
records[1][name]:WWW
records[1][ttl]:300
records[1][value]:90.61.137.171
records[2][line]:
records[2][type]:CNAME
records[2][name]:DT
records[2][ttl]:300
records[2][value]:raf924.dtdns.net
records[3][line]:
records[3][type]:CNAME
records[3][name]:FT
records[3][ttl]:300
records[3][value]:farrentether.fr.nf
*/
