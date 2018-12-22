function loadXMLDoc() {
    "use strict";
    let xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = function () {
        if (this.readyState === 4 && this.status === 200) {
            makeTable(this);
            }
        }
    xmlhttp.open("GET", "heroes.xml", true);
    xmlhttp.send();
}
                                                    
function makeTable(xml) {
    let i;
    let xmlDoc = xml.responseXML;
    let table="<tr><th>Name</th><th>Type</th><th>Role</th><th>Element</th></tr>";
    let x = xmlDoc.getElementsByTagName("HERO");
    for (i = 0; i <x.length; i++) {
        table += "<tr><td>" +
            x[i].getElementsByTagName("NAME")[0].childNodes[0].nodeValue +
                "</td><td>" +
            x[i].getElementsByTagName("TYPE")[0].childNodes[0].nodeValue +
                "</td><td>" +
            x[i].getElementsByTagName("ROLE")[0].childNodes[0].nodeValue +
                "</td><td>" +
            x[i].getElementsByTagName("ELEMENT")[0].childNodes[0].nodeValue +
                "</td></tr>";    
            }
    document.getElementById("hero-table").innerHTML = table;
}