'use strict';

const express = require('express');
const { spawn } = require('node:child_process');
const fs = require('node:fs');

const app = express();

app.disable('x-powered-by');


const BOARD_SIZE = 19;

const HOST = process.env.HOST || '127.0.0.1';
const PORT = readIntEnv('PORT', 3000, 1, 65535);

const KATAGO_PATH = process.env.KATAGO_PATH || '';
const MODEL_PATH = process.env.KATAGO_MODEL_PATH || '';
const CONFIG_PATH = process.env.KATAGO_CONFIG_PATH || '';

const AI_API_TOKEN = process.env.AI_API_TOKEN || '';

const TIMEOUT_MS = readIntEnv('KATAGO_TIMEOUT_MS', 10000, 1000, 60000);
const MAX_CONCURRENT = readIntEnv('MAX_CONCURRENT', 1, 1, 8);
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = readIntEnv('RATE_LIMIT_MAX', 20, 1, 300);

let activeJobs = 0;

/**
 * 默认只允许本机访问。
 * 如果你要用 0.0.0.0 / ngrok / 服务器公网暴露，必须设置 AI_API_TOKEN。
 */
const isLoopbackHost =
  HOST === '127.0.0.1' ||
  HOST === 'localhost' ||
  HOST === '::1';

if (!isLoopbackHost && !AI_API_TOKEN && process.env.ALLOW_PUBLIC_NO_TOKEN !== '1') {
  console.error('拒绝启动：当前 HOST 不是本机地址，但没有设置 AI_API_TOKEN。');
  console.error('如果只是本地调试，使用默认 HOST=127.0.0.1。');
  console.error('如果确实要暴露公网，请设置 AI_API_TOKEN。');
  process.exit(1);
}

assertFileExists(KATAGO_PATH, 'KATAGO_PATH');
assertFileExists(MODEL_PATH, 'KATAGO_MODEL_PATH');
assertFileExists(CONFIG_PATH, 'KATAGO_CONFIG_PATH');

/**
 * 限制请求体大小。
 * 19x19 二维数组很小，20kb 已经足够。
 */
app.use(express.json({
  limit: '20kb',
  strict: true
}));

app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: '请求体过大' });
  }

  if (err instanceof SyntaxError && err.status === 400) {
    return res.status(400).json({ error: 'JSON格式错误' });
  }

  return next(err);
});

/**
 * 简单限流：防止别人疯狂刷 /ai-move。
 */
const rateLimitMap = new Map();

function rateLimit(req, res, next) {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  let record = rateLimitMap.get(key);

  if (!record || now - record.startTime > RATE_LIMIT_WINDOW_MS) {
    record = {
      startTime: now,
      count: 0
    };
    rateLimitMap.set(key, record);
  }

  record.count += 1;

  if (record.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: '请求太频繁，请稍后再试' });
  }

  return next();
}

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now - record.startTime > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitMap.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW_MS).unref?.();

/**
 * 可选 token。
 * 本地调试可以不设置 AI_API_TOKEN。
 * 暴露公网时必须设置。
 */
function requireToken(req, res, next) {
  if (!AI_API_TOKEN) {
    return next();
  }

  const auth = req.get('authorization') || '';
  const expected = `Bearer ${AI_API_TOKEN}`;

  if (auth !== expected) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  return next();
}

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    activeJobs,
    maxConcurrent: MAX_CONCURRENT
  });
});

app.post('/ai-move', rateLimit, requireToken, (req, res) => {
  let board;
  let player;

  try {
    const parsed = parseAiMoveRequest(req.body);
    board = parsed.board;
    player = parsed.player;
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  if (activeJobs >= MAX_CONCURRENT) {
    return res.status(429).json({ error: 'AI正在计算中，请稍后再试' });
  }

  activeJobs += 1;

  const katagoArgs = [
    'gtp',
    '-model', MODEL_PATH,
    '-config', CONFIG_PATH
  ];

  const commands = buildGtpCommands(board, player);

  let katago;
  let stdout = '';
  let stderr = '';
  let responded = false;
  let cleaned = false;

  const timeoutId = setTimeout(() => {
    if (katago && !katago.killed) {
      katago.kill();
    }

    reply(504, {
      error: 'KataGo计算超时',
      move: { x: -1, y: -1 }
    });
  }, TIMEOUT_MS);

  function cleanup() {
    if (cleaned) return;

    cleaned = true;
    activeJobs -= 1;
    clearTimeout(timeoutId);
  }

  function reply(statusCode, payload) {
    if (responded) return;

    responded = true;
    cleanup();
    return res.status(statusCode).json(payload);
  }

  try {
    katago = spawn(KATAGO_PATH, katagoArgs, {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
  } catch (err) {
    return reply(500, { error: 'KataGo启动失败，请检查路径和权限' });
  }

  katago.stdout.setEncoding('utf8');
  katago.stderr.setEncoding('utf8');

  katago.stdout.on('data', (data) => {
    stdout = appendLimited(stdout, data, 64 * 1024);
  });

  katago.stderr.on('data', (data) => {
    stderr = appendLimited(stderr, data, 64 * 1024);
  });

  katago.on('error', () => {
    return reply(500, { error: 'KataGo启动失败，请检查路径、模型和配置文件' });
  });

  katago.on('close', (code) => {
    if (responded) {
      cleanup();
      return;
    }

    if (code !== 0) {
      console.error('KataGo异常退出，code =', code);
      if (stderr) {
        console.error('KataGo错误摘要:', stderr.slice(-1000));
      }

      return reply(500, { error: 'KataGo运行失败，请检查路径、模型和配置文件' });
    }

    const move = parseGTPCoords(stdout);

    return reply(200, { move });
  });

  katago.stdin.on('error', () => {
    return reply(500, { error: '写入KataGo命令失败' });
  });

  try {
    katago.stdin.write(commands.join('\n') + '\n');
    katago.stdin.end();
  } catch (err) {
    return reply(500, { error: '发送KataGo命令失败' });
  }
});

app.use((err, req, res, next) => {
  console.error('未处理错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, HOST, () => {
  console.log(`AI服务器已启动：http://${HOST}:${PORT}`);
  console.log(`最大并发：${MAX_CONCURRENT}，单次超时：${TIMEOUT_MS}ms`);
  console.log(AI_API_TOKEN ? '接口鉴权：已开启' : '接口鉴权：未开启，仅建议本机调试使用');
});

/**
 * 解析并校验请求。
 */
function parseAiMoveRequest(body) {
  if (!body || typeof body !== 'object') {
    throw new Error('请求体必须是JSON对象');
  }

  const { board, player } = body;

  if (player !== 1 && player !== 2) {
    throw new Error('player必须是1或2');
  }

  return {
    board: sanitizeBoard(board),
    player
  };
}

/**
 * 棋盘校验：
 * - 允许小于19行/列，自动补0，兼容你原来的写法。
 * - 不允许超过19行/列。
 * - 只允许 0、1、2。
 */
function sanitizeBoard(input) {
  if (!Array.isArray(input)) {
    throw new Error('board必须是二维数组');
  }

  if (input.length > BOARD_SIZE) {
    throw new Error('board不能超过19行');
  }

  const board = [];

  for (let y = 0; y < BOARD_SIZE; y++) {
    const row = input[y] || [];

    if (!Array.isArray(row)) {
      throw new Error(`board第${y + 1}行必须是数组`);
    }

    if (row.length > BOARD_SIZE) {
      throw new Error(`board第${y + 1}行不能超过19列`);
    }

    const safeRow = [];

    for (let x = 0; x < BOARD_SIZE; x++) {
      const value = row[x] ?? 0;

      if (value !== 0 && value !== 1 && value !== 2) {
        throw new Error(`board[${y}][${x}]只能是0、1、2`);
      }

      safeRow.push(value);
    }

    board.push(safeRow);
  }

  return board;
}

/**
 * 生成GTP命令。
 *
 * 这里保留你原来的 place 命令风格。
 * 如果你的 KataGo 提示 unknown command: place，
 * 把下面的 `place` 改成标准 GTP 的 `play`。
 */
function buildGtpCommands(board, player) {
  const commands = [
    'boardsize 19',
    'clear_board'
  ];

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const cell = board[y][x];

      if (cell === 1) {
        commands.push(`place b ${pointToGtp(x, y)}`);
      } else if (cell === 2) {
        commands.push(`place w ${pointToGtp(x, y)}`);
      }
    }
  }

  commands.push(`genmove ${player === 1 ? 'b' : 'w'}`);
  commands.push('quit');

  return commands;
}

/**
 * GTP标准列坐标跳过 I：
 * A B C D E F G H J K L M N O P Q R S T
 */
const GTP_COLUMNS = 'ABCDEFGHJKLMNOPQRST';

function pointToGtp(x, y) {
  return `${GTP_COLUMNS[x]}${y + 1}`;
}

function gtpToPoint(coord) {
  const text = String(coord).trim().toUpperCase();

  if (text === 'PASS' || text === 'RESIGN') {
    return { x: -1, y: -1 };
  }

  const match = text.match(/^([A-HJ-T])([1-9]|1[0-9])$/);

  if (!match) {
    return { x: -1, y: -1 };
  }

  const x = GTP_COLUMNS.indexOf(match[1]);
  const y = Number(match[2]) - 1;

  if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) {
    return { x: -1, y: -1 };
  }

  return { x, y };
}

/**
 * 解析 KataGo 的 GTP 输出。
 * 常见输出：
 * = D5
 * = pass
 * = resign
 */
function parseGTPCoords(output) {
  const text = String(output || '');

  if (/\bpass\b/i.test(text) || /\bresign\b/i.test(text)) {
    return { x: -1, y: -1 };
  }

  const matches = [...text.matchAll(/=\s*([A-HJ-Ta-hj-t](?:[1-9]|1[0-9]))\b/g)];

  if (matches.length === 0) {
    console.warn('KataGo坐标解析失败，输出摘要:', text.slice(-1000));
    return { x: -1, y: -1 };
  }

  const lastCoord = matches[matches.length - 1][1];
  return gtpToPoint(lastCoord);
}

function appendLimited(current, chunk, maxLength) {
  const next = current + chunk;
  if (next.length <= maxLength) return next;
  return next.slice(-maxLength);
}

function readIntEnv(name, defaultValue, min, max) {
  const raw = process.env[name];

  if (raw === undefined || raw === '') {
    return defaultValue;
  }

  const value = Number(raw);

  if (!Number.isInteger(value) || value < min || value > max) {
    console.warn(`${name}配置无效，使用默认值 ${defaultValue}`);
    return defaultValue;
  }

  return value;
}

function assertFileExists(filePath, name) {
  if (!filePath) {
    console.error(`缺少环境变量：${name}`);
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`${name} 指向的文件不存在：${filePath}`);
    process.exit(1);
  }
}