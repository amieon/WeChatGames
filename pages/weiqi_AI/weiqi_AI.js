Page({
  data: {
    viewWidth: 300,  // 棋盘宽度（rpx）
    geLength: 10,    // 每个格子长度（计算后）
    geNum: 19,       // 19x19棋盘
    ratio: 0.75,     // 棋子占格子比例
    whiteArray: [],  // 白子数组
    blackArray: [],  // 黑子数组
    isWhite: false,  // 黑子先下（围棋规则）
    textShow: '黑子下',
    isGameOver: false,
    passCount: 0,    // 连续Pass计数
    capturedBlack: 0, // 吃掉的黑子数
    capturedWhite: 0, // 吃掉的白子数
  },

  // 初始化
  init: function() {
    const ctx = wx.createCanvasContext('customCanvas');
    this.drawBoard(ctx);
    this.drawPieces(ctx);
    ctx.draw();
  },

  // 绘制棋盘
  drawBoard: function(ctx) {
    ctx.setLineWidth(1);
    ctx.setStrokeStyle("#000000");
    for (let i = 0; i < this.data.geNum; i++) {
      ctx.moveTo((0.5 + i) * this.data.geLength, 0.5 * this.data.geLength);
      ctx.lineTo((0.5 + i) * this.data.geLength, this.data.viewWidth - 0.5 * this.data.geLength);
      ctx.moveTo(0.5 * this.data.geLength, (0.5 + i) * this.data.geLength);
      ctx.lineTo(this.data.viewWidth - 0.5 * this.data.geLength, (0.5 + i) * this.data.geLength);
      ctx.stroke();
    }
  },

  // 绘制棋子
// 绘制棋子
drawPieces: function(ctx) {
  const blackPiece = '../../images/stone_b1.png';
  const whitePiece = '../../images/stone_w2.png';
  for (let i = 0; i < this.data.whiteArray.length; i++) {
    let point = this.data.whiteArray[i];
    ctx.drawImage(whitePiece, (point.x + (1 - this.data.ratio)/2) * this.data.geLength, 
      (point.y + (1 - this.data.ratio)/2) * this.data.geLength, 
      this.data.geLength * this.data.ratio, this.data.geLength * this.data.ratio);
  }
  for (let i = 0; i < this.data.blackArray.length; i++) {
    let point = this.data.blackArray[i];
    ctx.drawImage(blackPiece, (point.x + (1 - this.data.ratio)/2) * this.data.geLength, 
      (point.y + (1 - this.data.ratio)/2) * this.data.geLength, 
      this.data.geLength * this.data.ratio, this.data.geLength * this.data.ratio); 
  }
},
  touchStart: function(e) {},
  touchMove: function(e) {},
  // 触摸落子
  touchEnd: function(e) {
    if (this.data.isGameOver) return false;
    const mPoint = this.getValidPoint(e.changedTouches[0]);
    if (this.isHasPoint(mPoint, this.data.whiteArray) || this.isHasPoint(mPoint, this.data.blackArray)) {
      return false;
    }
    // 用户落子（黑子）
    if (!this.data.isWhite) {
      this.data.blackArray.push(mPoint);
      this.checkCapture(mPoint, 1); // 检查吃白子
      this.setShowTextViewString();
      this.init();
      // 轮到AI（白子）
      if (!this.data.isGameOver) {
        this.aiMove();
      }
    }
  },

  // AI走棋
  aiMove: function() {
    wx.showLoading({ title: '思考中...' });
    // 合并黑白子为棋盘数组
    const board = Array(19).fill().map(() => Array(19).fill(0));
    this.data.blackArray.forEach(p => board[p.y][p.x] = 1);
    this.data.whiteArray.forEach(p => board[p.y][p.x] = 2);
    wx.request({
      url: 'http://localhost:3000/ai-move',
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: { board, player: 2 }, // 白子AI
      timeout: 150000,
      success: (res) => {
        wx.hideLoading();
        const moveStr = res.data.move;
        const move = this.parseMove(moveStr)
        console.log(move.x+" "+move.y)
        if (move && move.x !== -1 && move.y !== -1 && !this.isHasPoint({x: move.x, y: move.y}, this.data.blackArray.concat(this.data.whiteArray))) {
          this.data.whiteArray.push({ x: move.x, y: move.y });
          this.checkCapture({ x: move.x, y: move.y }, 2); // 检查吃黑子
          this.setShowTextViewString();
          this.init();
        } else {
          // AI Pass
          this.pass();
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({ title: '连接失败', icon: 'error' });
      }
    });
  },

  // Pass按钮
  pass: function() {
    if (this.data.isGameOver) return;
    this.data.passCount++;
    if (this.data.passCount >= 2) {
      this.data.isGameOver = true;
      this.setData({ textShow: '游戏结束！' });
      this.calculateScore();
    } else {
      this.setShowTextViewString();
    }
  },
  parseMove:function(moveStr) {
  // 去掉前缀 "= " 和空格
  moveStr = moveStr.trim().replace(/^=\s*/, "");

  // 提取第一个合法坐标（字母+数字）
  const match = moveStr.match(/[A-Za-z]\d+/);
  if (!match) return null;

  const coord = match[0]; // 比如 "C4"
  const colLetter = coord[0].toUpperCase();
  const row = parseInt(coord.slice(1), 10);

  // 围棋列字母（跳过 I）
  const letters = "ABCDEFGHJKLMNOPQRST"; 
  const col = letters.indexOf(colLetter) + 1; // 1-based

  return {
    x: col, // 列
    y: row  // 行
  };
  },
  
  checkCapture: function(point, player) {
    const opponent = player === 1 ? this.data.whiteArray : this.data.blackArray;
    const directions = [[0,1], [0,-1], [1,0], [-1,0]]; // 上下左右
    let captured = [];
    directions.forEach(dir => {
      const nx = point.x + dir[0];
      const ny = point.y + dir[1];
      if (nx >= 0 && nx < 19 && ny >= 0 && ny < 19) {
        const group = this.getGroup({ x: nx, y: ny }, opponent);
        if (group.length > 0 && this.hasNoLiberties(group, opponent)) {
          captured = captured.concat(group);
        }
      }
    });
    if (captured.length > 0) {
      const newArray = opponent.filter(p => !captured.some(c => c.x === p.x && c.y === p.y));
      if (player === 1) {
        this.data.whiteArray = newArray;
        this.data.capturedBlack += captured.length;
      } else {
        this.data.blackArray = newArray;
        this.data.capturedWhite += captured.length;
      }
      this.setData({ whiteArray: this.data.whiteArray, blackArray: this.data.blackArray });
    }
  },

  // 获取连通棋子组
  getGroup: function(point, array) {
    const group = [];
    const visited = new Set();
    const stack = [point];
    while (stack.length > 0) {
      const p = stack.pop();
      if (!visited.has(`${p.x},${p.y}`) && this.isHasPoint(p, array)) {
        group.push(p);
        visited.add(`${p.x},${p.y}`);
        [[0,1], [0,-1], [1,0], [-1,0]].forEach(dir => {
          const nx = p.x + dir[0], ny = p.y + dir[1];
          if (nx >= 0 && nx < 19 && ny >= 0 && ny < 19) {
            stack.push({ x: nx, y: ny });
          }
        });
      }
    }
    return group;
  },

  // 检查棋子组是否有气
  hasNoLiberties: function(group, array) {
    for (const p of group) {
      const liberties = [[0,1], [0,-1], [1,0], [-1,0]].filter(dir => {
        const nx = p.x + dir[0], ny = p.y + dir[1];
        return nx >= 0 && nx < 19 && ny >= 0 && ny < 19 && 
               !this.isHasPoint({ x: nx, y: ny }, this.data.blackArray.concat(this.data.whiteArray));
      });
      if (liberties.length > 0) return false;
    }
    return true;
  },

  // 计算分数（简单版：KataGo可提供精确SGF分数）
  calculateScore: function() {
    // 简单计分：黑子数+吃白子数 vs 白子数+吃黑子数+贴目
    const blackScore = this.data.blackArray.length + this.data.capturedWhite;
    const whiteScore = this.data.whiteArray.length + this.data.capturedBlack + 6.5;
    const winner = blackScore > whiteScore ? '黑子胜' : '白子胜';
    wx.showToast({ title: `${winner}！黑:${blackScore}, 白:${whiteScore}` });
  },

  // 设置显示文字
  setShowTextViewString: function() {
    this.data.isWhite = !this.data.isWhite;
    this.setData({
      textShow: this.data.isGameOver ? '游戏结束！' : (this.data.isWhite ? '白子下' : '黑子下')
    });
  },

  // 重新开始
  reStart: function() {
    this.setData({
      whiteArray: [],
      blackArray: [],
      isWhite: false,
      textShow: '黑子下',
      isGameOver: false,
      passCount: 0,
      capturedBlack: 0,
      capturedWhite: 0
    });
    this.init();
  },

  // 悔棋
  backStep: function() {
    if (this.data.isGameOver) return;
    if (this.data.whiteArray.length > 0 || this.data.blackArray.length > 0) {
      if (this.data.isWhite) {
        this.data.blackArray.pop();
      } else {
        this.data.whiteArray.pop();
      }
      this.data.passCount = 0;
      this.setShowTextViewString();
      this.init();
    } else {
      wx.showToast({ title: '不能再悔棋啦！' });
    }
  },

  // 处理触摸点
  getValidPoint: function(point) {
    let x = Math.floor(point.x / this.data.geLength);
    let y = Math.floor(point.y / this.data.geLength);
    return { x: Math.min(Math.max(x, 0), 18), y: Math.min(Math.max(y, 0), 18) };
  },

  // 判断是否包含某个点
  isHasPoint: function(point, mArray) {
    return mArray.some(p => p.x === point.x && p.y === point.y);
  },

  onLoad: function(options) {
    let that = this;
    wx.getSystemInfo({
      success: (res) => {
        that.setData({
          viewWidth: res.windowWidth - 40,
          geLength: (res.windowWidth - 40) / that.data.geNum
        });
        this.init();
      }
    });
  },

  onShow: function() {
    this.init();
  }
});