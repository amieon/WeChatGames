//snake.js
var app = getApp();

Page({
   data:{
        userInfo: {},
        message_snake:"snake",
        message_count:0,
        message_lenth:5,
        score: 0,//比分
        maxscore: 0,//最高分
        ground:[],//操场,二维数组
        intiNode:[2,2,2,2,2,4,4,4,8],//新出现的节点的数字
        rows:5,
        cols:5,//操场大小
        modalHidden: true,
        start_flag:1,//0 为未开始 1为开始游戏
        timer:'',
   } ,  

  
   getBlockColor(num) {
    switch (num) {
      case 0: return "#cdc1b4"; 
      case 2: return "#eee4da";
      case 4: return "#ede0c8";
      case 8: return "#f2b179";
      case 16: return "#f59563";
      case 32: return "#f67c5f";
      case 64: return "#f65e3b";
      case 128: return "#edcf72";
      case 256: return "#edcc61";
      case 512: return "#edc850";
      case 1024: return "#edc53f";
      case 2048: return "#edc22e";
      default: return "#3c3a32"; 
    }
  },
  
  getNewNode() {
    let ground = this.data.ground;
    let rows = this.data.rows;
    let cols = this.data.cols;
    let list = [];
  
    for (let i = 0; i < rows; ++i) {
      for (let j = 0; j < cols; ++j) {
        if (ground[i][j] === 0) {
          list.push([i, j]);
        }
      }
    }
  
    if (list.length > 0) {
      let pos = Math.floor(Math.random() * list.length);
      let [x, y] = list[pos];
      ground[x][y] = this.data.intiNode[Math.floor(Math.random() * this.data.intiNode.length)];
  
      this.setData({
        ground: ground
      });
    }
    else{
      this.setData({
        maxscore:this.score,
        modalHidden: false,
      })
    }
  },
  
   onLoad:function(){
        
     var that = this
     //调用应用实例的方法获取全局数据  
     app.getUserInfo(function (userInfo) {
       //更新数据  
       that.setData({
         userInfo: userInfo
       })
     }) 
     setTimeout(function () {
       that.setData({
         maxscore: app.globalData.maxscore,
       });
       console.log(that.data.maxscore);     
     }, 3000)
        this.initGround(this.data.rows,this.data.cols);//初始化操场
        this.getNewNode()
        this.getNewNode()
        
   },

  //操场
  initGround: function (rows, cols) {
    let ground = [];
    for (let i = 0; i < rows; i++) {
      let arr = [];
      for (let j = 0; j < cols; j++) {
        arr.push(0);
      }
      ground.push(arr);
    }
    this.setData({
      ground: ground
    });
  },

    compressLine: function(line) {
      return line.filter(num => num !== 0);
    },
  
    mergeLine: function(line) {
      let newLine = [];
      let skip = false;
      let score = 0; 
      for (let i = 0; i < line.length; i++) {
        if (skip) { skip = false; continue; }
        if (i + 1 < line.length && line[i] === line[i + 1]) {
          let mergedValue = line[i] * 2;
          newLine.push(mergedValue);
          score += mergedValue;
          skip = true;
        } else {
          newLine.push(line[i]);
        }
      }
      return { newLine, score };
    },

    btnLeft: function() {
      let ground = this.data.ground;
      let moved = false;
      let totalScore = 0; 

      for (let i = 0; i < this.data.rows; i++) {
        let row = ground[i];
        let compressed = this.compressLine(row);
        let { newLine, score } = this.mergeLine(compressed);
        totalScore += score; 
        while (newLine.length < this.data.cols) newLine.push(0);
    
        if (newLine.toString() !== row.toString()) moved = true;
        ground[i] = newLine;
      }
    
      if (moved) {
        this.setData({ 
          ground: ground,
          score: this.data.score + totalScore 
        });
        this.getNewNode();
      }
    },
    
    btnRight: function() {
      let ground = this.data.ground;
      let moved = false;
      let totalScore = 0; 
    
      for (let i = 0; i < this.data.rows; i++) {
        let row = ground[i].slice().reverse();
        let compressed = this.compressLine(row);
        let { newLine, score } = this.mergeLine(compressed);
        totalScore += score; 
        while (newLine.length < this.data.cols) newLine.push(0);
        newLine = newLine.reverse();
    
        if (newLine.toString() !== ground[i].toString()) moved = true;
        ground[i] = newLine;
      }
    
      if (moved) {
        this.setData({ 
          ground: ground,
          score: this.data.score + totalScore 
        });
        this.getNewNode();
      }
    },
    
    btnTop: function() {
      let ground = this.data.ground;
      let moved = false;
      let totalScore = 0; 
    
      for (let j = 0; j < this.data.cols; j++) {
        let col = [];
        for (let i = 0; i < this.data.rows; i++) col.push(ground[i][j]);
    
        let compressed = this.compressLine(col);
        let { newLine, score } = this.mergeLine(compressed);
        totalScore += score; 
        while (newLine.length < this.data.rows) newLine.push(0);
    
        for (let i = 0; i < this.data.rows; i++) {
          if (ground[i][j] !== newLine[i]) moved = true;
          ground[i][j] = newLine[i];
        }
      }
    
      if (moved) {
        this.setData({ 
          ground: ground,
          score: this.data.score + totalScore 
        });
        this.getNewNode();
      }
    },
    
    btnBottom: function() {
      let ground = this.data.ground;
      let moved = false;
      let totalScore = 0; 
    
      for (let j = 0; j < this.data.cols; j++) {
        let col = [];
        for (let i = this.data.rows - 1; i >= 0; i--) col.push(ground[i][j]);
    
        let compressed = this.compressLine(col);
        let { newLine, score } = this.mergeLine(compressed);
        totalScore += score; 
        while (newLine.length < this.data.rows) newLine.push(0);
        newLine = newLine.reverse();
    
        for (let i = 0; i < this.data.rows; i++) {
          if (ground[i][j] !== newLine[i]) moved = true;
          ground[i][j] = newLine[i];
        }
      }
    
      if (moved) {
        this.setData({ 
          ground: ground,
          score: this.data.score + totalScore 
        });
        this.getNewNode();
      }
    },
    modalChange:function(){
    this.setData({
        score: 0,
        ground:[],
        snake:[],
        food:[],
        modalHidden: true,
        direction:'',
        start_flag:0,
    })
    this.onLoad();
    }
  
});