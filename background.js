console.log(" ========= background ..")

// 存储检测到的音频请求
let detectedAudioRequests = [];



// 音频相关的 MIME 类型和文件扩展名
// 添加更多音频相关的MIME类型
const audioMimeTypes = [
  'audio/',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/wav',
  'audio/ogg',
  'audio/aac',
  'audio/flac',
  'audio/x-m4a',
  'audio/webm',
  'audio/x-matroska',
  'application/octet-stream',
  'application/x-mpegURL',
  'application/vnd.apple.mpegURL'
];

// 扩展音频文件扩展名列表
const audioExtensions = [
  '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.wma',
  '.ape', '.opus', '.mid', '.midi', '.amr', '.m4r', '.ac3',
  '.dsf', '.dff', '.webm', '.mka', '.m3u8', '.ts'
];

// 判断URL是否为音频链接
// 优化音频URL检测函数
function isAudioUrl(url) {
  const urlLower = url.toLowerCase();
  
  // 特殊处理网易云音乐的URL模式
  if (urlLower.includes('music.163.com') || urlLower.includes('.music.126.net')) {
    return urlLower.includes('.m4a') ||
           urlLower.includes('.mp3') ||
           urlLower.includes('.wav') ||
           urlLower.includes('.ogg') ||
           urlLower.includes('.aac') ||
           urlLower.includes('.flac')
  }
  
  // 检查文件扩展名
  return audioExtensions.some(ext => urlLower.includes(ext));
}

// 监听网络请求，优化错误处理
chrome.webRequest.onHeadersReceived.addListener(
  function(details) {
    try {
      // 检查响应头中的Content-Type
      const contentTypeHeader = details.responseHeaders?.find(
        header => header.name.toLowerCase() === 'content-type'
      );
      
      const contentType = contentTypeHeader?.value.toLowerCase() || '';
      
      // 检查是否为音频内容类型
      const isAudioContentType = audioMimeTypes.some(type => contentType.includes(type));
      
      // 如果是音频内容类型或URL匹配音频模式
      if (isAudioContentType || isAudioUrl(details.url)) {
        console.log('检测到音频请求:', details.url);
        console.log('Content-Type:', contentType);
        // 将新的音频URL添加到数组开头
        if (!detectedAudioRequests.includes(details.url)) {
          detectedAudioRequests.unshift(details.url);
        }
        
        // 发送消息到content script
        if (details.tabId && details.tabId >= 0) {
          chrome.tabs.sendMessage(details.tabId, {
            action: 'newAudioDetected',
            audioUrl: details.url,
            contentType: contentType
          }).catch(error => {
            console.error('发送消息到content script失败:', error);
          });
        } else {
          console.warn('无效的tabId:', details.tabId);
        }
      }
    } catch (error) {
      console.error('处理网络请求时出错:', error);
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

// 监听来自content script的消息
// Service Worker 激活时的处理
chrome.runtime.onInstalled.addListener(() => {
  console.log('Service Worker 已安装');
  // 清空之前的音频请求记录
  detectedAudioRequests = [];
});

// 确保Service Worker保持活跃
chrome.runtime.onStartup.addListener(() => {
  console.log('Service Worker 启动');
});

// 优化错误处理
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getDetectedAudio') {
    try {
      const audioList = Array.from(detectedAudioRequests);
      sendResponse(audioList);
    } catch (error) {
      console.error('获取音频列表时出错:', error);
      sendResponse([]);
    }
    return true; // 保持消息通道开放
  }
});

// 定期清理过期的音频请求
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24小时
  // 保持现有顺序进行过滤
  detectedAudioRequests = detectedAudioRequests.filter(url => {
    return true; // 暂时保留所有URL，后续可以添加时间戳功能
  });
}, 60 * 60 * 1000); // 每小时清理一次