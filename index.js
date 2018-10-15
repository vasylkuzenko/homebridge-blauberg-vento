'use strict';

var Service;
var Characteristic;
var UUIDGen;

var broadcast = '000000000000000009000000e00729070b00170a00000000c0a80a0555c100008ec20000000006000000000000000000';
var dgram = require('dgram');

// EXAMPLE CONFIG
// {
//     "accessory": "BlaubergVento",
//     "name": "Vento Bedroom",
//     "host": "10.0.0.00",
//     "serialNumber": "000100101234430F"
// },
// {
//     "accessory": "BlaubergVentoHumidity",
//     "name": "Vento Bedroom Humidity Sensor",
//     "host": "10.0.0.00"
// },

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;
    homebridge.registerAccessory('homebridge-blauberg-vento', 'BlaubergVento', UdpMultiswitch);
    homebridge.registerAccessory('homebridge-blauberg-vento-humidity', 'BlaubergVentoHumidity', BlaubergVentoHumidity);
};

function UdpMultiswitch(log, config) {
    this.log = log;

    this.name            = config.name || 'Blauberg Vento';
    this.host            = config.host;
    this.port            = config.port || 4000;
    this.serialNumber    = config.serialNumber || '';

    this.deviceInfoCache = [];


}

UdpMultiswitch.prototype = {

    getDeviceInfo: function(callback){
        if(this.deviceInfoCallInProgress){
            this.needUpdateInfoInHomeKit = true;
            this.log.info('getDeviceInfo inprogress');
        }else{
            if(this.deviceInfoCache && (this.deviceInfoLastUpdate - Date.now() <= 10000)){
                callback(this.deviceInfoCache);
            }else{
                var that = this;
                var payload = '6D6F62696C65' + '01' + '01' + '0D0A';
    
                that.log.info('try getDeviceInfo');

                this.deviceInfoCallInProgress = true;
    
                this.udpRequest(this.host, this.port, payload, function (error) {
                    this.deviceInfoCallInProgress = false;
                    if(error) {
                        that.log.error('getDeviceInfo failed: ' + error.message);
                    }
                }.bind(this), function (msg, rinfo) {
                    this.deviceInfoCallInProgress = false;

                    msg = that._parseResponseBuffer(msg);
    
                    this.deviceInfoLastUpdate = Date.now();
    
                    this.deviceInfoCache = msg;

                   
                    
        
                    that.log.info('getDeviceInfo success');
                    callback(msg);

                    if(this.needUpdateInfoInHomeKit){
                        this.needUpdateInfoInHomeKit = false;
                        this.updateAllCharacteristic(msg);
                    }
                }.bind(this));
            }
        }
    },

    updateAllCharacteristic: function(msg){
        var speed = msg[21];
        speed = Math.round(speed/255*100);

        if(this.fanService){
            this.fanService.setCharacteristic(Characteristic.Active, msg[7]);
            this.fanService.setCharacteristic(Characteristic.RotationSpeed, speed);
            this.fanService.setCharacteristic(Characteristic.FilterChangeIndication, msg[31]);
            this.fanService.setCharacteristic(Characteristic.SwingMode, msg[23]);
            this.fanService.setCharacteristic(Characteristic.CurrentRelativeHumidity, msg[25]);
        }
    },

    udpRequest: function(host, port, payloadMessage, callback, callbackResponse) {
        if(!callback){callback = function(){};}
        if(!callbackResponse){callbackResponse = function(){};}

        var client = dgram.createSocket('udp4');
        var delayTime = Math.floor(Math.random() * 1500) + 1;
        var message = new Buffer(payloadMessage, 'hex');

        setTimeout(function() { 
            client.send(broadcast, 0, broadcast.length, port, host, function(err, bytes) {
                if (err) throw err;

                client.send(message, 0, message.length, port, host, function(err, bytes) {
                    if (err) throw err;
                    
                 //   console.log('UDP message sent to ' + host +':'+ port, message);

                    client.on('message', function(msg, rinfo){
                     //   console.log('UDP message get', msg);
                        callbackResponse(msg, rinfo);
                        client.close();
                    });
            
                    callback(err);
                });
                
            });
        }, delayTime);

    },

    _parseResponseBuffer: function(data){
        return JSON.parse(JSON.stringify(data)).data;
    },

    getFilterStatus: function (targetService, callback, context){
        this.getDeviceInfo(function(msg){
            callback(null, msg[31]);
        });
    },


    getCustomSpeed: function (targetService, callback, context) {
        this.getDeviceInfo(function(msg){
            var speed = msg[21];
            speed = Math.round(speed/255*100);
            callback(null, speed);
        });
    },

    setCustomSpeed: function(targetService, speed, callback, context) {      
        var payload = '6D6F62696C65'+'05'+(Math.round(255/100*speed).toString(16))+'0D0A'

        this.udpRequest(this.host, this.port, payload, function(error) {
            if (error) {
                this.log.error('setCustomSpeed failed: ' + error.message);
                this.log('response: ' + response + '\nbody: ' + responseBody);
            
                callback(error);
            } else {
                this.log.info('set speed ' + speed);
            }
            callback();
        }.bind(this), function (msg, rinfo) {
            msg = that._parseResponseBuffer(msg);

            this.deviceInfoLastUpdate = Date.now();

            this.deviceInfoCache = msg;

            that.log.info('getDeviceInfo success');
        }.bind(this));
    },

    getPowerState: function (targetService, callback, context) {
        this.getDeviceInfo(function(msg){
            callback(null, msg[7]);
        });
    },

    setPowerState: function(targetService, powerState, callback, context) { 
        var that = this;
        var payload = '6D6F62696C65'+'03'+'00'+'0D0A';

        if(powerState == that.deviceInfoCache[7]){//workaround, blauberg can't on/off device, only toggle  
            callback();
        }else{
            this.udpRequest(this.host, this.port, payload, function(error) {
                if (error) {
                    this.log.error('setPowerState failed: ' + error.message);            
                    callback(error);
                } else {
                    this.log.info('setPowerState ' + powerState);
                }
                callback();
            }.bind(this), function (msg, rinfo) {
                msg = that._parseResponseBuffer(msg);
    
                this.deviceInfoLastUpdate = Date.now();
    
                this.deviceInfoCache = msg;
    
                that.log.info('getDeviceInfo success');
            }.bind(this));
        }
    },

    getHumidity: function(targetService, callback, context){
        this.getDeviceInfo(function(msg){
            callback(null, msg[25]);
        });
    },

    getFanState: function (targetService, callback, context) {
        this.getDeviceInfo(function(msg){
            callback(null, msg[23]);
        });
    },

    setFanState: function(targetService, fanState, callback, context) { 
        var that = this;

        if(1 == fanState){
            var comand = '01';
        }else if(0 == fanState){
            var comand = '00';
        }

        var payload = '6D6F62696C65'+'06'+comand+'0D0A';

        this.udpRequest(this.host, this.port, payload, function(error) {
            if (error) {
                this.log.error('setFanState failed: ' + error.message);            
                callback(error);
            } else {
                this.log.info('setFanState ' + fanState);
            }
            callback();
        }.bind(this), function (msg, rinfo) {
            msg = that._parseResponseBuffer(msg);

            this.deviceInfoLastUpdate = Date.now();

            this.deviceInfoCache = msg;

            that.log.info('getDeviceInfo success');
        }.bind(this));
        
    },

    identify: function (callback) {
        this.log.debug('[%s] identify', this.displayName);
        callback();
    },

    getServices: function () {
        this.services = [];

        var informationService = new Service.AccessoryInformation();
        informationService
            .setCharacteristic(Characteristic.Manufacturer, 'Blauberg')
            .setCharacteristic(Characteristic.Model, 'Vento Expert')
            .setCharacteristic(Characteristic.SerialNumber, this.serialNumber)
        ;
        this.services.push(informationService);


        this.fanService = new Service.Fanv2(this.name);
        this.fanService
            .getCharacteristic(Characteristic.Active)
            .on('get', this.getPowerState.bind(this, this.fanService))
            .on('set', this.setPowerState.bind(this, this.fanService))
        ;
        this.fanService
            .getCharacteristic(Characteristic.RotationSpeed)
            .on('get', this.getCustomSpeed.bind(this, this.fanService))
            .on('set', this.setCustomSpeed.bind(this, this.fanService))
        ;
        this.fanService
            .getCharacteristic(Characteristic.FilterChangeIndication)
            .on('get', this.getFilterStatus.bind(this, this.fanService))
        ;
        this.fanService
            .getCharacteristic(Characteristic.SwingMode)
            .on('get', this.getFanState.bind(this, this.fanService))
            .on('set', this.setFanState.bind(this, this.fanService))
        ;
        this.fanService
            .getCharacteristic(Characteristic.CurrentRelativeHumidity)
            .on('get', this.getHumidity.bind(this, this.fanService))
        ;
    
        this.services.push( this.fanService);
     
        
        return this.services;
    }
};

function BlaubergVentoHumidity(log, config) {
    this.log = log;

    this.name            = config.name || 'Blauberg VentoHumidity';
    this.host            = config.host;
    this.port            = config.port || 4000;
    this.serialNumber    = config.serialNumber || '';

}

BlaubergVentoHumidity.prototype = {

    udpRequest: function(host, port, payloadMessage, callback, callbackResponse) {
        if(!callback){callback = function(){};}
        if(!callbackResponse){callbackResponse = function(){};}

        var client = dgram.createSocket('udp4');
        var delayTime = Math.floor(Math.random() * 1500) + 1;
        var message = new Buffer(payloadMessage, 'hex');

        setTimeout(function() { 
            client.send(broadcast, 0, broadcast.length, port, host, function(err, bytes) {
                if (err) throw err;

                client.send(message, 0, message.length, port, host, function(err, bytes) {
                    if (err) throw err;
                    
                 //   console.log('UDP message sent to ' + host +':'+ port, message);

                    client.on('message', function(msg, rinfo){
                     //   console.log('UDP message get', msg);
                        callbackResponse(msg, rinfo);
                        client.close();
                    });
            
                    callback(err);
                });
                
            });
        }, delayTime);

    },

    _parseResponseBuffer: function(data){
        return JSON.parse(JSON.stringify(data)).data;
    },

    

    getHumidity: function(targetService, callback, context){
        var that = this;
        var payload = '6D6F62696C65' + '01' + '01' + '0D0A';

        this.udpRequest(this.host, this.port, payload, function (error) {
            if(error) {
                that.log.error('getHumidity failed: ' + error.message);
            }
        }, function (msg, rinfo) {
            msg = that._parseResponseBuffer(msg);

            that.log.info('getHumidity success: ', msg[25]);
            
            callback(null,  msg[25]);
        });
    },

    identify: function (callback) {
        this.log.debug('[%s] identify', this.displayName);
        callback();
    },

    getServices: function () {
        this.services = [];

        var informationService = new Service.AccessoryInformation();
        informationService
            .setCharacteristic(Characteristic.Manufacturer, 'Blauberg')
            .setCharacteristic(Characteristic.Model, 'Vento Expert')
        ;
        this.services.push(informationService);


        var fanService = new Service.HumiditySensor(this.name);
        fanService
            .getCharacteristic(Characteristic.CurrentRelativeHumidity)
            .on('get', this.getHumidity.bind(this, fanService))
        ;

        this.services.push(fanService);
        
        return this.services;
    }
};
