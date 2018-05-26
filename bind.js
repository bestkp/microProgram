// pages/bind/bind.js
var app = getApp();
const mac = wx.getStorageSync('mac')
Page({
  /**
   * 页面的初始数据
   */
  data: {
    loading: false,
    mac: mac,
    deviceId: ''
  },
  /**
   * 绑定事件
   */
  binding: function () {
    var timer = null;
    var _this = this;
    wx.openBluetoothAdapter({
      success: res => {
        _this.setData({
          msg: '功能已启用'
        })
        wx.onBluetoothAdapterStateChange(res => {
          _this.setData({
            actioninfo: res.available ? "蓝牙适配器可用" : "蓝牙适配器不可用",
            searchingstatus: res.discovering ? "正在搜索" : "搜索可用"
          })
        })
        wx.onBluetoothDeviceFound(res => {
          var devices = res.devices;
          if (_this.data.system.indexOf('iOS') >= 0) {
            let advertisData = devices[0].advertisData;
            if (advertisData != null) {
              // let bf = advertisData.slice(4, 10);
              let aftermac = Array.prototype.map.call(new Uint8Array(advertisData), x => ('00' + x.toString(16)).slice(-2)).join(':');
              console.log('ios', aftermac)
              if (aftermac.toUpperCase().indexOf(mac) >= 0) {
                wx.hideLoading();
                clearTimeout(timer)
                wx.showLoading({
                  title: '开始连接设备...',
                })
                _this.setData({
                  deviceId: devices[0].deviceId
                });
                _this.connectTO();
              }
            }
            
          } else {
            if (devices[0].deviceId == mac) {
              wx.hideLoading();
              clearTimeout(timer)
              wx.showLoading({
                title: '开始连接设备...',
              })
              _this.setData({
                deviceId: devices[0].deviceId
              });
              _this.connectTO();
            }
          }
        });
        wx.showLoading({
          title: '开始搜索设备...',
          mask: false
        });
        timer = setTimeout(() => {
          wx.hideLoading();
          wx.showToast({
            title: '未搜索到设备',
            icon: 'none',
            duration: 1500
          })
        }, 20000)
        setTimeout(() => {
          _this.searchbluetooth();
        }, 2000)
      },
      fail: err => {
        console.log(err)
        wx.showToast({
          title: '请打开蓝牙',
        })
      }
    })
  },
  searchbluetooth: function () {
    wx.startBluetoothDevicesDiscovery({
      success: res => {}
    })
  },
  stop: function () {
    wx.stopBluetoothDevicesDiscovery({
      success: res => {
        console.log("停止蓝牙搜索")
      }
    });
    wx.closeBluetoothAdapter({
      success: function (res) {
        console.log('蓝牙已关闭')
      }
    })
  },
  /**
   * 连接设备
   */
  connectTO: function () {
    var _this = this;
    wx.createBLEConnection({
      deviceId: _this.data.deviceId,
      success: res => {
        console.log("连接设备成功")
        _this.getAllservice();
      },
      fail: err => {
        console.log("连接设备失败")
        _this.setData({
          connected: false
        })
      }
    })
    wx.stopBluetoothDevicesDiscovery(function () {

    })
  },
  /**
   * 获取连接设备服务
   */
  getAllservice: function (e) {
    var _this = this;
    wx.getBLEDeviceServices({
      deviceId: _this.data.deviceId,
      success: res => {
        var services = res.services;
        var service_id = '';
        _this.setData({
          services: res.services
        })
        for (let i = 0; i < res.services.length; i++) {
          if (services[i].uuid.indexOf("00008957") != -1) {
            service_id = services[i].uuid;
            break;
          }
        }
        _this.setData({
          service_id
        })
        wx.setStorageSync('serviceid', service_id);
        _this.getDeviceCharacter();
      },
      fail: err => {
        console.error('getServiceError', err);
      }
    })
  },
  //获取连接设备的所有特征值  
  getDeviceCharacter: function () {
    var _this = this;
    wx.getBLEDeviceCharacteristics({
      deviceId: _this.data.deviceId,
      serviceId: wx.getStorageSync('serviceid'),
      success: res => {
        let notify_id, write_id, read_id;
        for (let i = 0; i < res.characteristics.length; i++) {
          let charc = res.characteristics[i];
          // if (charc.properties.notify) {
          notify_id = '00000F02-786E-4340-8BBB-2201C8699534'//charc.uuid;
          // }
          if (charc.properties.write) {
            write_id = charc.uuid;
          }
          if (charc.properties.write) {
            read_id = charc.uuid;
          }
        }
        console.log('特征值', notify_id, write_id, read_id)
        if (notify_id != null && write_id != null) {
          _this.setData({
            notify_id,
            write_id,
            read_id
          })
          _this.openNotify(function () {
            _this.setData({
              write: 1
            })
            _this.write('8004');
          });
        }
      }
    })
  },
  /**
   * 打开通知
   */
  openNotify: function (callback) {
    var _this = this;
    wx.notifyBLECharacteristicValueChange({
      state: true,
      deviceId: _this.data.deviceId,
      serviceId: _this.data.service_id,
      characteristicId: _this.data.notify_id,
      complete: res => {
        setTimeout(function () {
          _this.onOpenNotify && _this.onOpenNotify();
        }, 1000);
        callback();
      }
    });
    _this.onNotifyChange();
  },
  /**
   * 向蓝牙写入数据
   */
  write: function (data) {
    var _this = this;
    // 00000F01-786E-4340-8BBB-2201C8699534
    console.log('writeData', data);
    wx.writeBLECharacteristicValue({
      deviceId: _this.data.deviceId,
      serviceId: _this.data.service_id,
      characteristicId: '00000F01-786E-4340-8BBB-2201C8699534',//_this.data.write_id,
      value: _this.hexStringToArrayBuffer(data),
      success: res => {
        console.log('write', res)
      },
      fail: err => {
        console.log('writeErr111', err);
      },
    })
  },
  /**
   * 接收蓝牙返回值
   */
  onNotifyChange: function (callback) {
    var _this = this;
    wx.onBLECharacteristicValueChange(res => {
      let msg = _this.arrayBufferToHexString(res.value);
      callback && callback(msg);
      console.log('挑战码', msg);
      if (_this.data.write == 1) {
        _this.upChallengeCode(msg);
      } else {
        console.log('第二次', msg)
        const sn = wx.getStorageSync('sn');
        let result = msg === 'E100' ? 'success' : 'fail';
        wx.request({
          url: app.globalData.host+'uploadCmdResult' ,
          data: {
            "msgID": "000000001",
            "time": new Date().getTime(),
            "idUser": wx.getStorageSync('openid'),
            "token": "token",
            "reqType": "getDevStatus",
            "reqData": {
              "idDev": sn,
              "command": "0902",
              "result": result
            }
          },
          method: 'POST',
          success: res => {
            console.log('uploadCmdResult', res);
            const respData = res.data.data.respData;
            wx.hideLoading();
            wx.hideToast();
            wx.showToast({
              title: '绑定成功',
            })
            _this.stop()
            setTimeout(() => {
              wx.navigateTo({
                url: '../open/open?unbind=1',
              })
            }, 1500)
            
          },
          fail: err => {
            console.error('upChallengeCode', res);
          }
        })
      }
    })
  },
  /**
   * 获取挑战码
   */
  upChallengeCode: function (challengeCode) {
    var _this = this;
    const sn = wx.getStorageSync('sn');
    wx.request({
      url: app.globalData.host+'getBleAuthCode',
      data: {
        "msgID": "000000001",
        "time": new Date().getTime(),
        "idUser": wx.getStorageSync('openid'),
        "token": "token",
        "reqType": "getDevStatus",
        "reqData": {
          "idDev": '0F11803000007',
          "chanllegeCode": challengeCode.substr(4),
          "bleCmd": "805001"
        }
      },
      method: 'POST',
      success: res => {
        console.log('upChallengeCode', res);
        const respData = res.data.data.respData;
        const { authCode } = respData;
        const zuhe = `805001${authCode}`;
        _this.openNotify(function () {
          _this.setData({
            write: 2
          })
          _this.write(zuhe);
        });
      },
      fail: err => {
        console.error('upChallengeCode', res);
      }
    })
  },
  arrayBufferToHexString: function (buffer) {
    let bufferType = Object.prototype.toString.call(buffer)
    if (buffer != '[object ArrayBuffer]') {
      return
    }
    let dataView = new DataView(buffer)
    var hexStr = '';
    for (var i = 0; i < dataView.byteLength; i++) {
      var str = dataView.getUint8(i);
      var hex = (str & 0xff).toString(16);
      hex = (hex.length === 1) ? '0' + hex : hex;
      hexStr += hex;
    }
    return hexStr.toUpperCase();
  },
  hexStringToArrayBuffer(str) {
    if (!str) {
      return new ArrayBuffer(0);
    }
    var buffer = new ArrayBuffer(str.length / 2);
    let dataView = new DataView(buffer)
    let ind = 0;
    for (var i = 0, len = str.length; i < len; i += 2) {
      let code = parseInt(str.substr(i, 2), 16)
      dataView.setUint8(ind, code)
      ind++
    }
    return buffer;
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    var _this = this;
    wx.getSystemInfo({
      success: res => {
        _this.setData({
          system: res.system
        })
      },
    })
  },
})