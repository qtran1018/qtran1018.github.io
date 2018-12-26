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
    let heroTable="<tr><th>Name</th><th>Type</th><th>Role</th><th>Element</th></tr>";
    let x = xmlDoc.getElementsByTagName("HERO");
    for (i = 0; i <x.length; i++) {
        heroTable += "<tr><td>" +
            x[i].getElementsByTagName("NAME")[0].childNodes[0].nodeValue +
                "</td><td>" +
            x[i].getElementsByTagName("TYPE")[0].childNodes[0].nodeValue +
                "</td><td>" +
            x[i].getElementsByTagName("ROLE")[0].childNodes[0].nodeValue +
                "</td><td>" +
            x[i].getElementsByTagName("ELEMENT")[0].childNodes[0].nodeValue +
                "</td></tr>";    
            }
    document.getElementById("hero-table").innerHTML = heroTable;
}

function filterTable() {
  // Declare variables
  var input, filter, table, tr, td, i, txtValue;
  input = document.getElementById("myInput");
  filter = input.value.toUpperCase();
  table = document.getElementById("hero-table");
  tr = table.getElementsByTagName("tr");

  // Loop through all table rows, and hide those who don't match the search query
  for (i = 0; i < tr.length; i++) {
    td = tr[i].getElementsByTagName("td")[0];
    if (td) {
      txtValue = td.textContent || td.innerText;
      if (txtValue.toUpperCase().indexOf(filter) > -1) {
        tr[i].style.display = "";
      } else {
        tr[i].style.display = "none";
        }
    }
  }
}