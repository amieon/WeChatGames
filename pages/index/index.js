//index.js
//获取应用实例
var app = getApp()
Page({
  data: {
    motto: '哈喽',
    userInfo: {}
  },
  //事件处理函数
  bindViewTap: function() {
    const that = this;
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        console.log('获取成功：', res.userInfo);
        that.setData({
          userInfo: res.userInfo
        });
      },
      fail: (err) => {
        console.log('用户拒绝授权：', err);
      }
    });
  },
  onLoad: function () {
    console.log('onLoad')
    var that = this
    //调用应用实例的方法获取全局数据
    app.getUserInfo(function(userInfo){
      //更新数据
      that.setData({
        userInfo:userInfo
      })
    })
  },
  goSnake: function () {
    wx.navigateTo({
      url: '/pages/snake/snake'
    })
  },
  go2048: function () {
    wx.navigateTo({
      url: '/pages/2048/2048'
    })
  },  
  gobird: function () {
    wx.navigateTo({
      url: '/pages/bird/bird'
    })
  },
  goblock: function () {
    wx.navigateTo({
      url: '/pages/block/block'
    })
  },
  goWeiqi: function() {
    wx.showActionSheet({
      itemList: ['双人对决', '单人游戏'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({ url: '/pages/weiqi_BT/weiqi_BT' })
        } else if (res.tapIndex === 1) {
          wx.navigateTo({ url: '/pages/weiqi_AI/weiqi_AI' })
        }
      }
    })
  },

  goWuziqi: function() {
    wx.showActionSheet({
      itemList: ['双人对决', '单人游戏'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({ url: '/pages/wuziqi_BT/wuziqi_BT' })
        } else if (res.tapIndex === 1) {
          wx.navigateTo({ url: '/pages/wuziqi_AI/wuziqi_AI' })
        }
      }
    })
  }
})
