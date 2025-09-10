App({
  onLaunch: function () {

  },
  getUserInfo: function (cb) {
    var that = this;
    if (this.globalData.userInfo) {
      typeof cb == "function" && cb(this.globalData.userInfo)
    } else {
      //调用登录接口  
      wx.login({
        success: function (res) {
          if (res.code) {
            //发起网络请求
            wx.request({
              url: 'https://你的后端/login',
              method: 'GET',
              //请求成功
              success: (res) => {
                that.globalData.openid = res.data.openid;
                wx.request({
                  url: '你后端发的 session token' + res.data.openid,
                  method: 'GET',
                  //请求成功
                  success: (res) => {
                    // 返回状态码 200
                    that.globalData.maxscore = res.data.score;
                  },
                  fail: (res) => {
                    console.log("fail");
                    console.log(res.errMsg);
                  },
                });
              },
              fail: (res) => {
                console.log("fail");
                console.log(res.errMsg);
              },
            });

          }
          wx.getUserInfo({
            success: function (res) {
              that.globalData.userInfo = res.userInfo;
              typeof cb == "function" && cb(that.globalData.userInfo)
            }
          })
        }
      });
    }
  },
  globalData: {
    userInfo: null,
    openid:null,
    maxscore:null,
  }
})  