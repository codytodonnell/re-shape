angular.module('wigs')

.factory('mapService', [
function() {

	var colors = ["#66c2a5","#D31021","#ffd92f","#923FBF","#fc8d62","#885053","#b3b3b3","#a6d854"];
	var lookup = {
		tracks: {},
		number: 0
	};
	var map;

	function setMap(value) {
		map = value;
	}

	function getMap() {
		return map;
	}

	/**
	 *
	 * For each track in tracksLookup, draw the track on the map
	 * Only draws the points that fall within the time range set by the brush
	 *
	 */
	function drawFilteredTrack(domainMin, domainMax) {
		for (key in lookup.tracks) {
			var track = lookup.tracks[key];
			var trackData = track.features[0];
			var data = {
				"type": "Feature",
				"properties": {
					"name": trackData.properties.name,
					"time": trackData.properties.time,
					"coordTimes": []
				},
				"geometry": {
					"type": trackData.geometry.type,
					"coordinates": []
				}
			};
			var filtered = filterCoordinates(trackData, domainMin, domainMax);
			data.properties.coordTimes = filtered.coordTimes;
			data.geometry.coordinates = filtered.coordinates;
			map.getSource(key).setData(data);
		};
	}

	/**
	 *
	 * Filter the coordinates of all uploaded tracks based on the boundaries set by the line chart brush.
	 * Returns an object with two arrays: one for coordinates and one for coordTimes.
	 * Handles geojson types LineStrings and MultiLineStrings
	 *
	 */
	function filterCoordinates(data, domainMin, domainMax) {
		var coords = data.geometry.coordinates;
		var coordTimes = data.properties.coordTimes;
		var filteredCoords = [];
		var filteredCoordTimes = [];

		if(data.geometry.type === 'LineString') {
			// Find the first coordinate that is greater than or equal to the minimum bound on the brush
			var filterIndexMin = coordTimes.findIndex(function(t) {
				var coordTime = new Date(t);
				return coordTime >= domainMin;
			});

			// Find the first coordinate that is greater than or equal to the maximum bound on the brush
			var filterIndexMax = coordTimes.findIndex(function(t) {
				var coordTime = new Date(t);
				return coordTime >= domainMax;
			});

			// If a min index was found but not a max, the max index should be the last item
			if(filterIndexMin >= 0 && filterIndexMax === -1) {
				filterIndexMax = coordTimes.length - 1;
			}

			filteredCoords = coords.slice(filterIndexMin, filterIndexMax);
			filteredCoordTimes = coordTimes.slice(filterIndexMin, filterIndexMax);
		} else if(data.geometry.type === 'MultiLineString') {

			// MultiLineStrings require that we find indexes to identify a containing array of coordinates and the coordinates themselves
			var minLineIndex,
				minCoordIndex,
				maxLineIndex,
				maxCoordIndex;

			/**
			 *
			 * First, initialize resulting filtered arrays with the correct number of line segments.
			 * The number of line segments should not be affected by the filter.
			 * The filter will only affect the coordinates contained in each segment.
			 *
			 */
			coords.forEach(function(segment) {
				filteredCoords.push([]);
				filteredCoordTimes.push([]);
			});


			/**
			 *
			 * Second, loop through coordTime segments and determine the which segments and coordinates to include.
			 * When the min coordinate is found, set minLineIndex to the segment the coordinate is in.
			 * Do the same for the max coordinate.
			 * If a min coordinate is found but not a max, this means the filter's max value is larger than any coordinate in this data.
			 * In this situation, the max coordinate should be the last coordinate in the data.
			 *
			 */
			for(var i = 0; i < coordTimes.length; i++) {
				if(minLineIndex === undefined) {
					minCoordIndex = coordTimes[i].findIndex(function(t) {
						var coordTime = new Date(t);
						return coordTime >= domainMin;
					});
					if(minCoordIndex >= 0) minLineIndex = i;
				}
				
				if(maxLineIndex === undefined) {
					maxCoordIndex = coordTimes[i].findIndex(function(t) {
						var coordTime = new Date(t);
						return coordTime >= domainMax;
					});
					if(maxCoordIndex >= 0) {
						maxLineIndex = i;
					} else if(minLineIndex >= 0 && i === coordTimes.length - 1) {
						maxLineIndex = i;
						maxCoordIndex = coordTimes[i].length - 1;
					}
				}

				if(minLineIndex && maxLineIndex) break;
			}

			/**
			 *
			 * Third, loop through segments again and use the index bounds to create the filtered arrays of coordinates and coordTimes.
			 * If a segment falls between the min and max, include all its coordinates.
			 * If a segment is outside the range of the filter, assign an empty array to its position in the output.
			 *
			 */
			for(var i = 0; i < coordTimes.length; i++) {
				if(minLineIndex === i && maxLineIndex === i) {
					filteredCoords[i] = coords[i].slice(minCoordIndex, maxCoordIndex);
					filteredCoordTimes[i] = coordTimes[i].slice(minCoordIndex, maxCoordIndex);
				} else if(minLineIndex === i && maxLineIndex !== i) {
					filteredCoords[i] = coords[i].slice(minCoordIndex);
					filteredCoordTimes[i] = coordTimes[i].slice(minCoordIndex);
				} else if(minLineIndex !== i && maxLineIndex === i) {
					filteredCoords[i] = coords[i].slice(0, maxCoordIndex);
					filteredCoordTimes[i] = coordTimes[i].slice(0, maxCoordIndex);
				} else if(i > minLineIndex && i < maxLineIndex) {
					filteredCoords[i] = coords[i];
					filteredCoordTimes[i] = coordTimes[i];
				} else {
					filteredCoords[i] = [];
					filteredCoordTimes[i] = [];
				}
			}
		}

		return {
			coordinates: filteredCoords,
			coordTimes: filteredCoordTimes
		}
	}

	/**
	 *
	 * Move each track's location point when hover over a chart time.
	 * For LineStrings and MultiLineStrings, this finds the first coordinate 
	 * that is greater than or equal to the time selected on the chart.
	 *
	 */
	function moveLocationPoints(selectedTime) {
		for (key in lookup.tracks) {
			var track = lookup.tracks[key];
			var trackData = track.features[0];
			var number = key.split("track")[1];
			var coordIndex,
				coordLineIndex;
			var data = {
				"type": "Point",
				"coordinates": []
			};

			if(trackData.geometry.type === 'LineString') {
				coordIndex = trackData.properties.coordTimes.findIndex(function(t) {
					var coordTime = new Date(t);
					return coordTime >= selectedTime;
				});
				if(coordIndex >= 0) {
					data.coordinates = trackData.geometry.coordinates[coordIndex];
					map.getSource('point' + number).setData(data);
				}
			} else if(trackData.geometry.type === 'MultiLineString') {
				for(var i = 0; i < trackData.properties.coordTimes.length; i++) {
					if(coordLineIndex === undefined) {
						coordIndex = trackData.properties.coordTimes[i].findIndex(function(t) {
							var coordTime = new Date(t);
							return coordTime >= selectedTime;
						});
						if(coordIndex >= 0) {
							coordLineIndex = i;
							data.coordinates = trackData.geometry.coordinates[coordLineIndex][coordIndex];
							map.getSource('point' + number).setData(data);
						}
					}
				}
			}
		}
	}

	function clearMap() {
		for (key in lookup.tracks) {
			var number = key.split("track")[1];
			map.removeLayer('point' + number);
			map.removeLayer(key);
			map.removeSource('point' + number);
			map.removeSource(key);
		}
		lookup.tracks = {};
		lookup.number = 0;
	}

	return {
		colors: colors,
		lookup: lookup,
		setMap: setMap,
		getMap: getMap,
		drawFilteredTrack: drawFilteredTrack,
		moveLocationPoints: moveLocationPoints,
		clearMap: clearMap
	}
}]);