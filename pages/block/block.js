// block
var app = getApp()
Page({
  data: {
    typeName: '别踩白块儿：限时模式',
    score: 0,
    time: 60,
    shouldStop: false,
    blockData:[],
    modalHidden: true,
    words:"再试一次"
  },
  onReady: function(){
      var array = [];
      for(var i = 0; i < 10; i++){
          var orderArray = [0,0,0,0];
          var randomNum = Math.floor(Math.random() * 4);
          orderArray[randomNum] = 1;
          array.push({id: i, block: orderArray});
      }
      this.setData({
          blockData: array.reverse()
      });
  },
  handleClick: function(events){
      var id = events.currentTarget.id;
      var line = id.split("-")[1];
      var column = id.split("-")[2];
      var isBlack = id.split("-")[3];
      var blockData = this.data.blockData.reverse();
      var score = this.data.score;
      var orderArray = [0,0,0,0];
      // 判断是否是第一行
      if(line != blockData[0].id){
        this.setData({words:"不是第一行黑键"})
        this.handleWrong(0, score);
        return;
      }
      // 判断是否正确
      if(isBlack != 1){
        this.setData({words:"踩到白块了"})
        this.handleWrong(1, score);
        return;
      }

      // 正确下一个
      // 分数++
      // 最后一个小块的id为分数+10
      score++;
      orderArray[Math.floor(Math.random() * 4)] = 1;
      blockData.push({id: score+10, block: orderArray});
      blockData.shift();
      this.setData({
          silding: true,
          score: score,
          blockData: blockData.reverse()
      });
  },

  timeInterval: function() {
    var that = this; 
    var timer = setInterval(function() {
      var nowTime = that.data.time;


      if (that.data.shouldStop) {
        clearInterval(timer);
        return;
      }

      if (nowTime > 1) {
        that.setData({
          time: nowTime - 1
        });
        return;
      }

      that.setData({
        time: 0,
        words: `时间到，得分为${that.data.score}`,
        modalHidden: false  
      });

      that.handleWrong(2, that.data.score);
      clearInterval(timer);  
    }, 1000);

    that.data.timer = timer;
  },

  // 停止计时器（比如点击暂停或结束游戏）
  stopTimer: function() {
    var that = this;
    that.setData({ shouldStop: true });
    if (that.data.timer) {
      clearInterval(that.data.timer);
    }
  },

  // 重置计时器
  resetTimer: function() {
    var that = this;
    that.stopTimer();
    that.setData({
      time: 60,
      score: 0,
      words: "",
      shouldStop: false,
      modalHidden: true
    });
    that.timeInterval();  // 重新开始计时
  },

  handleWrong: function(type, score) {
   // console.log("游戏结束，类型:", type, "得分:", score);
    this.setData({
      modalHidden: false
    });
  },
  onLoad: function(){
      var that = this;
      wx.setNavigationBarTitle({
        title: that.data.typeName
      });
      this.timeInterval();
  },
  modalChange:function(){
    this.setData({
      typeName: '别踩白块儿：限时模式',
      score: 0,
      time: 60,
      shouldStop: false,
      blockData:[],
      modalHidden: true
    })
    this.onLoad();this.onReady();
    }
})
