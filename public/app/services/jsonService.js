angular.module('wigs')

.factory('jsonService', ['mapService',
function() {
	function addGeorgiaPopulationFields() {
		console.log("getting data");
		d3.json("public/app/data/georgia_populations.json").then(function(data) {
			console.log(data);

			data.features.forEach(function(d) {
				d.properties.WHITE_PCT = d.properties.WHITE / d.properties.POP2010;
				d.properties.BLACK_PCT = d.properties.BLACK / d.properties.POP2010;
				d.properties.ASIAN_PCT = d.properties.ASIAN / d.properties.POP2010;
				d.properties.HISPANIC_PCT = d.properties.HISPANIC / d.properties.POP2010;
				d.properties.AGE_20_24_PCT = d.properties.AGE_20_24 / d.properties.POP2010;
				d.properties.AGE_25_34_PCT = d.properties.AGE_25_34 / d.properties.POP2010;
			});

			console.log(data);

			function download(content, fileName, contentType) {
			    var a = document.createElement("a");
			    var file = new Blob([content], {type: contentType});
			    a.href = URL.createObjectURL(file);
			    a.download = fileName;
			    a.click();
			}

			download(JSON.stringify(data), 'georgia_populations_pct.json', 'text/plain');
		});
	}
	return {
		addGeorgiaPopulationFields: addGeorgiaPopulationFields
	}
}]);