'use strict';

var Service;
var Characteristic;
var UUIDGen;
var FakeGatoHistoryService;
var homebridgeAPI;

var dgram = require('dgram');

const { version } = require("./package.json");

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
    FakeGatoHistoryService = require("fakegato-history")(homebridge);
    homebridgeAPI = homebridge;
    homebridge.registerAccessory('homebridge-blauberg-vento', 'BlaubergVento', BlaubergVento);
};

function BlaubergVento(log, config) {
    this.log = log;

    this.name            = config.name || 'Blauberg Vento';
    this.displayName     = this.name;
    this.humidityName    = config.humidityName || this.name + ' Humidity';
    this.host            = config.host;
    this.port            = config.port || 4000;
    this.serialNumber    = config.serialNumber || '';
    this.updateTimeout   = config.updateTimeout || 30000;

    this.isFakeGatoEnabled   = config.isFakeGatoEnabled || false;
    this.fakeGatoStoragePath = config.fakeGatoStoragePath || false;

}

BlaubergVento.prototype = {

    udpRequest: function(host, port, payloadMessage, callback, callbackResponse) {
        if(!callback){callback = function(){};}
        if(!callbackResponse){callbackResponse = function(){};}

        var client = dgram.createSocket('udp4');
        var delayTime = Math.floor(Math.random() * 1500) + 1;
        var message = new Buffer(payloadMessage, 'hex');

        setTimeout(function() { 
            client.send(message, 0, message.length, port, host, function(err, bytes) {
                if (err) throw err;
        
                client.on('message', function(msg, rinfo){
                    callbackResponse(msg, rinfo);
                    client.close();
                });
        
                callback(err);
            });
                
        }, delayTime);

    },


    _parseResponseBuffer: function(data){
        return JSON.parse(JSON.stringify(data)).data;
    },

    _getStatusData: function(){
        var that = this;
        var payload = '6D6F62696C65' + '01' + '01' + '0D0A';
        
        this.udpRequest(this.host, this.port, payload, function (error) {
            if(error) {
                that.log.error('_getStatusData failed: ' + error.message);
            }
        }, function (msg, rinfo) {
            that.statusCache = that._parseResponseBuffer(msg);
            that.addFakeGatoHistoryEntry(that.statusCache[25]);

            that.log.info('_getStatusData success');
        });

    },

    getFilterStatus: function (targetService, callback, context) {
        var that = this;

        callback(null, that.statusCache[31]);
    },


    getCustomSpeed: function (targetService, callback, context) {
        var that = this;

        callback(null, Math.round(that.statusCache[21]/255*100));

    },

    setCustomSpeed: function(targetService, speed, callback, context) {      
        var that = this;
        var payload = '6D6F62696C65'+'05'+(Math.round(255/100*speed).toString(16))+'0D0A'

        this.udpRequest(this.host, this.port, payload, function(error) {
            if (error) {
                this.log.error('setCustomSpeed failed: ' + error.message);
                this.log('response: ' + response + '\nbody: ' + responseBody);
            
                callback(error);
            } else {
                this.log.info('set speed ' + speed);
                that.statusCache[21] = Math.round(255/100*speed);
            }
            callback();
        }.bind(this));
    },

    getPowerState: function (targetService, callback, context) {
        var that = this;

        callback(null, that.statusCache[7]);
    },

    setPowerState: function(targetService, powerState, callback, context){
        var that = this;
       
        var payload = '6D6F62696C65' + '01' + '01' + '0D0A';

        this.udpRequest(this.host, this.port, payload, function (error) {
            if(error) {
                that.log.error('getPowerState failed: ' + error.message);
            }
        }, function (msg, rinfo) {
            msg = that._parseResponseBuffer(msg);
            that.statusCache = msg;
           
            var currentActiveStatus = msg[7];

            if(powerState == currentActiveStatus){
                that.log.info('not need setPowerState ' + powerState);
                callback();
            }else{
                var payload = '6D6F62696C65'+'03'+'00'+'0D0A';

                that.udpRequest(that.host, that.port, payload, function(error){
                    if (error) {
                        that.log.error('setPowerState failed: ' + error.message);            
                        callback(error);
                    } else {
                        that.log.info('setPowerState ' + powerState);
                        that.statusCache[7] = powerState; 
                    }
                    callback();
                });
            }
        });
    },

    addFakeGatoHistoryEntry() {
        var that = this;
        if (
          !this.isFakeGatoEnabled 
        ) {
          return;
        }
        this.fakeGatoHistoryService .addEntry({
            time: new Date().getTime() / 1000,
            humidity: that.fanService.getCharacteristic(Characteristic.CurrentRelativeHumidity).value
        });
    },

    getFakeGatoHistoryService() {
        if (!this.isFakeGatoEnabled) {
          return undefined;
        }
        const serialNumber = this.serialNumber ;
        const filename = `fakegato-history_blauberg_humidity_${serialNumber}.json`;
        const path = this.fakeGatoStoragePath || homebridgeAPI.user.storagePath();
        return new FakeGatoHistoryService("room", this, {
          filename,
          path,
          storage: "fs"
        });
    },


    getHumidity: function(targetService, callback, context){
        var that = this;
        callback(null,  that.statusCache[25]);
    },

    getFanState: function (targetService, callback, context) {
        var that = this;
        callback(null,  that.statusCache[23]);
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
                that.statusCache[23] = fanState;
            }
            callback();
        }.bind(this));
        
    },

    identify: function (callback) {
        this.log.debug('[%s] identify', this.displayName);
        callback();
    },

    getServices: function () {
        var that = this;
        this.services = [];

        var informationService = new Service.AccessoryInformation();
        informationService
            .setCharacteristic(Characteristic.Manufacturer, 'Blauberg')
            .setCharacteristic(Characteristic.Model, 'Vento Expert')
            .setCharacteristic(Characteristic.SerialNumber, this.serialNumber)
            .setCharacteristic(Characteristic.FirmwareRevision, version)
        ;
        this.services.push(informationService);


        var fanService = new Service.Fanv2(this.name);
        fanService
            .getCharacteristic(Characteristic.Active)
            .on('get', this.getPowerState.bind(this, fanService))
            .on('set', this.setPowerState.bind(this, fanService))
        ;
        fanService
            .getCharacteristic(Characteristic.RotationSpeed)
            .on('get', this.getCustomSpeed.bind(this, fanService))
            .on('set', this.setCustomSpeed.bind(this, fanService))
        ;
        fanService
            .getCharacteristic(Characteristic.FilterChangeIndication)
            .on('get', this.getFilterStatus.bind(this, fanService))
        ;
        fanService
            .getCharacteristic(Characteristic.SwingMode)
            .on('get', this.getFanState.bind(this, fanService))
            .on('set', this.setFanState.bind(this, fanService))
        ;
        fanService
            .getCharacteristic(Characteristic.CurrentRelativeHumidity)
            .on('get', this.getHumidity.bind(this, fanService))
        ;
    
        that.fanService = fanService;

        this.services.push(fanService);

        var humidityService = new Service.HumiditySensor(this.humidityName);
        humidityService
            .getCharacteristic(Characteristic.CurrentRelativeHumidity)
            .on('get', this.getHumidity.bind(this, fanService))
        ;

        this.services.push(humidityService);

        this.fakeGatoHistoryService = this.getFakeGatoHistoryService();
      //  if(this.fakeGatoHistoryService){
            this.services.push(this.fakeGatoHistoryService);
     //   }
      

   
     
        that._getStatusData();
        that.updateInverval = setInterval(function(){
            that._getStatusData();
            that.addFakeGatoHistoryEntry();
        }, that.updateTimeout);
        
        return this.services;
    }
};