// update-rules.cjs (CommonJS 版本)
const https = require('https');
const fs = require('fs');
const path = require('path');

const rulesDir = path.join(__dirname, 'adblock-rules');

// 确保目录存在
if (!fs.existsSync(rulesDir)) {
  fs.mkdirSync(rulesDir, { recursive: true });
}

// 规则文件列表
const rules = [
  {
    url: 'https://easylist.to/easylist/easylist.txt',
    filename: 'easylist.txt'
  },
  {
    url: 'https://easylist.to/easylist/easyprivacy.txt',
    filename: 'easyprivacy.txt'
  },
  {
    url: 'https://easylist.to/easylist/fanboy-annoyance.txt',
    filename: 'fanboy-annoyance.txt'
  }
];

// 下载函数
function downloadRule(url, filename) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(rulesDir, filename);
    const file = fs.createWriteStream(filePath);
    
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`✅ 已下载: ${filename}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filePath, () => {});
      reject(err);
    });
  });
}

// 批量下载
async function updateRules() {
  console.log('开始更新广告过滤规则...');
  for (const rule of rules) {
    try {
      await downloadRule(rule.url, rule.filename);
    } catch (err) {
      console.error(`❌ 下载失败 ${rule.filename}:`, err.message);
    }
  }
  console.log('规则更新完成');
}

updateRules();