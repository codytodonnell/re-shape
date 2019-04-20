angular.module('wigs')

.controller('geographyController', ['$scope', 'mapService', 'lineChartService', 'toGeoJSON', 'jsonService', '$uibModal',
 function($scope, mapService, lineChartService, toGeoJSON, jsonService, $uibModal) {
	var vm = this;

	/**
	 *
	 * Initialize the Mapbox map
	 * Center point determined using bboxfinder.com
	 * accessToken for Cody O'Donnell
	 * Mapbox style by Cody O'Donnell
	 *
	 */
	mapboxgl.accessToken = 'pk.eyJ1IjoiY29kb25uZWxsIiwiYSI6ImNqbmNhaTlrNzBndDIzcHBvYnNla2RneHAifQ.OMGQ5aqcWXSsAKc8niEsEw';
	var map = new mapboxgl.Map({
		container: 'map',
		style: 'mapbox://styles/codonnell/cjs27n4bx1jcl1fpo320lk0pt',
		center: [-84.396286,33.772334],
		zoom: 12.0
	});

	mapService.setMap(map);

	const baseLayers = [
		'atlanta-health-coverage',
		'georgia-pop-white',
		'georgia-pop-black',
		'georgia-pop-hispanic',
		'georgia-pop-asian',
		'georgia-pop-20-24', 
		'georgia-pop-25-34', 
		'marta-lines',
		'marta-stations'
	];

	const colors = mapService.colors;

	vm.baseLayer = 'none';

	vm.yAxisValue = 'lat';

	vm.lookup = mapService.lookup;

	vm.tracksLoaded = false;

	vm.anyVisible = false;

	map.on('load', rescaleFromMapBounds);

	map.on('zoom', rescaleFromMapBounds);

	map.on('drag', rescaleFromMapBounds);

	vm.makeData = jsonService.addGeorgiaPopulationFields;

	vm.showImporter = true;

	vm.toggleImporter = function() {
		vm.showImporter = !vm.showImporter;
	}

	/**
	 *
	 * Include a reference to lineChartService's changeYAxis function in this controller's scope
	 * This enables it to be used in the template on the select input
	 *
	 */
	vm.changeYAxis =  function(value) {
		lineChartService.changeYAxis(value);
		console.log(map.getBounds());
	}

	/**
	 *
	 * Check the clicked track's visibility and toggle it
	 * Simply shows or hides the map line, map point, and chart line for the clicked track.
	 * Visibility is also maintained in tracksLookup to enable conditional styling in the template.
	 *
	 */
	vm.toggleTrack = function(trackId) {
		var visibility = map.getLayoutProperty(trackId, 'visibility');
		var number = trackId.split('track')[1];
		var pointId = 'point' + number;

		if(visibility === 'visible') {
			map.setLayoutProperty(trackId, 'visibility', 'none');
			map.setLayoutProperty(pointId, 'visibility', 'none');
			lineChartService.toggleLine(trackId, false);
			vm.lookup.tracks[trackId].visible = false;
		} else {
			map.setLayoutProperty(trackId, 'visibility', 'visible');
			map.setLayoutProperty(pointId, 'visibility', 'visible');
			lineChartService.toggleLine(trackId, true);
			vm.lookup.tracks[trackId].visible = true;
		}

		//vm.anyVisible = checkIfVisibleTracks();
	}

	/**
	 *
	 * Included a show all function for convenience
	 *
	 */
	vm.showAllTracks = function() {
		for (key in vm.lookup.tracks) {
			var number = key.split('track')[1];
			var pointId = 'point' + number;
			map.setLayoutProperty(key, 'visibility', 'visible');
			map.setLayoutProperty(pointId, 'visibility', 'visible');
			lineChartService.toggleLine(key, true);
			vm.lookup.tracks[key].visible = true;
		}
		vm.anyVisible = true;
	}

	vm.hideAllTracks = function() {
		for (key in vm.lookup.tracks) {
			var number = key.split('track')[1];
			var pointId = 'point' + number;
			map.setLayoutProperty(key, 'visibility', 'none');
			map.setLayoutProperty(pointId, 'visibility', 'none');
			lineChartService.toggleLine(key, false);
			vm.lookup.tracks[key].visible = false;
		}
		vm.anyVisible = false;
	}

	vm.checkIfAllVisible = function() {
		var allVisible = true;
		for (key in vm.lookup.tracks) {
			if (vm.lookup.tracks[key].visible === false) allVisible = false;
		}
		return allVisible;
	}

	vm.styleTrackButton = function(trackId) {
		if(vm.lookup.tracks[trackId].visible) {
			return {'background-color': vm.lookup.tracks[trackId].color};
		} else {
			return {'background-color': '#f8f9fa'};
		}
	}

	/**
	 *
	 * Display optional additional map layers
	 * baseLayers array contains the precise names of layers specified in my custom Mapbox Studio Style.
	 * The word "roads" refers to the actual base map that should always be displayed.
	 * If "roads" is selected, the additional layers should all become invisible.
	 *
	 */
	vm.changeBaseLayer = function() {
		baseLayers.forEach(function(d) {
			if(vm.baseLayer === 'none') {
				map.setLayoutProperty(d, 'visibility', 'none');
			} else if(d === vm.baseLayer) {
				map.setLayoutProperty(d, 'visibility', 'visible');
			} else if(d === 'marta-stations' && vm.baseLayer === 'marta-lines') {
				map.setLayoutProperty(d, 'visibility', 'visible');
			} else {
				map.setLayoutProperty(d, 'visibility', 'none');
			}
		});
	}

	function rescaleFromMapBounds() {
		var bounds = map.getBounds();
		lineChartService.rescaleYAxis(bounds);
	}
}]);

