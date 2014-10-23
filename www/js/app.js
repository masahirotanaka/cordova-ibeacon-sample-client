var PROX_UNKNOWN = 'ProximityUnknown';
var PROX_FAR = 'ProximityFar';
var PROX_NEAR = 'ProximityNear';
var PROX_IMMEDIATE = 'ProximityImmediate';

// Change the connecting server to different host
var server = 'http://cordova-ibeacon-sample.nodejitsu.com';

var app = angular.module('ibsample', ['onsen']);

app.factory('socket', function(){
    return io.connect(server);
});

app.service('iBeaconService', ['$http', function($http) {
    this.currentBeaconUuid = null;
    this.onDetectCallback = function(){};
    
    var beacons = {
        "00000000-EA98-1001-B000-001C4D9C64FA": {icon: 'img/1.jpg', rssi: -63, proximity: PROX_UNKNOWN, name: 'ITEM 1', number: '1', id: '000265C9', major: 1, minor: 1},
        "F5A10AF9-A670-4F54-B491-8607393F0DDC": {icon: 'img/2.jpg', rssi: -63, proximity: PROX_UNKNOWN, name: 'ITEM 2', number: '2', id: '0002D08D', major: 1, minor: 1},
        "ABE425B2-0000-4409-8035-1668AFC7FCFE": {icon: 'img/3.jpg', rssi: -63, proximity: PROX_UNKNOWN, name: 'ITEM 3', number: '3', id: '00029BAA', major: 1, minor: 1},
        "BC564E82-0000-43A3-94E7-1D54EC02622D": {icon: 'img/4.jpg', rssi: -63, proximity: PROX_UNKNOWN, name: 'ITEM 4', number: '4', id: '0003F321', major: 1, minor: 1},
        "6F29CF85-0000-414A-A7A6-6206A2DA9773": {icon: 'img/5.jpg', rssi: -63, proximity: PROX_UNKNOWN, name: 'ITEM 5', number: '5', id: '00027EA8', major: 1, minor: 1},
        "EEB52632-0000-47E2-8C15-897494E12015": {icon: 'img/6.jpg', rssi: -63, proximity: PROX_UNKNOWN, name: 'ITEM 6', number: '6', id: '00032449', major: 1, minor: 1}
    };
    this.beacons = beacons;
    
    this.requestInfo = function(number) {
        var url = server + '/item/' + number;
        return $http.get(url).then(function(response) {
            return response.data.description;
        });
    };
    
    createBeacons = function() {
        var result = [];
        try {
            angular.forEach(beacons, function(value, key) {
                result.push(new cordova.plugins.locationManager.BeaconRegion(value.id, key, value.major, value.minor));
            });
        } catch (e) {
            console.log('createBeacon err: ' + e);
        }
        return result;
    };
    
    this.watchBeacons = function(callback){
        document.addEventListener("deviceready", function(){
            var deviceVersion = window.device ? device.version : ''; 

            // required in iOS 8+
            if (deviceVersion.indexOf('8') > -1) {
                cordova.plugins.locationManager.requestWhenInUseAuthorization();
            }
    
            var beacons = createBeacons();
            
            try {
                var delegate = cordova.plugins.locationManager.delegate.implement({
                    didStartMonitoringForRegion: function(pluginResult) {
                        console.log('didStartMonitoringForRegion:' + JSON.stringify(pluginResult));
                    },
                
                    didRangeBeaconsInRegion: function(result) {
                        var beaconData = result.beacons[0];
                        var uuid = result.region.uuid.toUpperCase();
                        if (!beaconData || !uuid) {
                            return
                        }
                        
                        callback(beaconData, uuid);
                    }
                });
    
                cordova.plugins.locationManager.setDelegate(delegate);
                
                beacons.forEach(function(beacon) {
                    cordova.plugins.locationManager.startRangingBeaconsInRegion(beacon);
                });
            } catch (e) {
                console.log('Delegate err: ' + e);   
            }
        }, false);
    }
}]);

app.controller('AddCommentCtrl', ['$scope', 'iBeaconService', 'socket', function($scope, iBeaconService, socket) { 
    $scope.newImg = "";
    $scope.sendComment = function() {
        var newComment = {
            number: iBeaconService.beacons[iBeaconService.currentBeaconUuid].number,
            username: $scope.newUsername,
            comment: $scope.newComment,
            avatar: $scope.newImg
        };
        
        socket.emit('addcomment', newComment);
        $scope.myNavigator.popPage();
    };
    
    $scope.getPhoto = function() {

        var options = { 
            quality: 50,
            destinationType: Camera.DestinationType.DATA_URL, 
            encodingType: Camera.EncodingType.JPEG,
            targetWidth: 100,
            targetHeight: 100,
            saveToPhotoAlbum: false
        };

        navigator.camera.getPicture(function(imageData) {
            $scope.newImg = 'data:image/jpeg;base64,' + imageData;
            $scope.$evalAsync();
        }, function(message) {
            alert('Failed because: ' + message);
        }, options);
    };
}]);

app.controller('InfoPageCtrl', ['$scope', 'socket', 'iBeaconService', function($scope, socket, iBeaconService) {
    $scope.beacon = iBeaconService.beacons[iBeaconService.currentBeaconUuid];

    iBeaconService.requestInfo($scope.beacon.number).then(function(info) {
        $scope.beacon.description = info;
        socket.emit('listcomments', {number: $scope.beacon.number});
    });
    
    socket.on('comments', function(result) {
        $scope.comments = result.data;
        $scope.comments.forEach(function(comment) {
            comment['time'] = generateTimeDiff(comment.created);
        });
        $scope.totalComments = $scope.comments.length;
        $scope.$evalAsync();
    });
    
    socket.on('commentupdated', function(data) {
       socket.emit('listcomments', {number: $scope.beacon.number});
    });
    
     $scope.ons.navigator.on("prepop", function() {
        //socket.removeAllListeners();
    });
    
    function generateTimeDiff(date) {
        date = new Date(date);
        var today = new Date();
        var timeDiff = Math.floor((today - date) / (1000 * 60));
    
        if (timeDiff == 0) {
            timeDiff = 'just now';
        } else if (timeDiff > 0 && timeDiff < 60) {
            timeDiff = timeDiff + ' min ago';
        } else if (timeDiff >= 60 && timeDiff < (60*24)) {
            timeDiff = Math.floor(timeDiff/60) + ' h ago';
        } else {
            timeDiff = Math.floor(timeDiff/(60*24)) + ' d ago';
        }
    
        return timeDiff;
    }
}]);

app.controller('TopPageCtrl', ['$scope', 'socket', 'iBeaconService', function($scope, socket, iBeaconService) {        
    
    $scope.beacons = iBeaconService.beacons;
    
    var callback = function(deviceData, uuid)
    {
        var beacon = $scope.beacons[uuid];
        $scope.$apply(function()
        {
            beacon.rssi = deviceData.rssi;
            switch (deviceData.proximity)
            {
                case PROX_IMMEDIATE:
                    beacon.proximity = 'Immediate';
                    break;
                case PROX_NEAR:
                    beacon.proximity = 'Near';
                    break;
                case PROX_FAR:
                    beacon.proximity = 'Far';
                    break;
                case PROX_UNKNOWN:
                default:
                    break;
            }

            if (iBeaconService.currentBeaconUuid === null && beacon.rssi > -45) {
                $scope.enterInfoPage(uuid);
            }
        });
    };
    iBeaconService.watchBeacons(callback);

    
    $scope.enterInfoPage = function(currentUuid) {
        iBeaconService.currentBeaconUuid = currentUuid;
        $scope.ons.navigator.pushPage('info-page.html');
        $scope.ons.navigator.on("prepop", function() {
          iBeaconService.currentBeaconUuid = null;
        });
    }
    
}]);

