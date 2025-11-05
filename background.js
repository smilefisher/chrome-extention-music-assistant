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
  'application/vnd.apple.mpegURL',
  // 添加更多常见的音频MIME类型
  'audio/x-wav',
  'audio/x-aiff',
  'audio/basic',
  'audio/L24',
  'audio/mid',
  'audio/midi',
  'audio/x-midi',
  'audio/mp4a-latm',
  'audio/x-ms-wma',
  'audio/vnd.rn-realaudio',
  'audio/vnd.wave'
];

// 扩展音频文件扩展名列表
const audioExtensions = [
  '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.wma',
  '.ape', '.opus', '.mid', '.midi', '.amr', '.m4r', '.ac3',
  '.dsf', '.dff', '.webm', '.mka', '.m3u8', '.ts',
  // 添加更多音频文件扩展名
  '.aiff', '.aifc', '.au', '.ra', '.rm', '.ram', '.pls',
  '.cda', '.raw', '.vox', '.tta', '.m4b', '.m4p', '.3gp',
  '.snd', '.voc', '.xm', '.mod'
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

  // 特殊处理QQ音乐的URL模式
  if (urlLower.includes('qq.com') || urlLower.includes('qqmusic.qq.com')) {
    return true;
  }
  
  // 检查文件扩展名
  return audioExtensions.some(ext => urlLower.includes(ext));
}

// 监听网络请求，优化错误处理
chrome.webRequest.onHeadersReceived.addListener(
  function(details) {
    try {
      // 检查响应头中的Content-Type和Content-Disposition
      const contentTypeHeader = details.responseHeaders?.find(
        header => header.name.toLowerCase() === 'content-type'
      );
      const contentDispositionHeader = details.responseHeaders?.find(
        header => header.name.toLowerCase() === 'content-disposition'
      );
      
      const contentType = contentTypeHeader?.value.toLowerCase() || '';
      const contentDisposition = contentDispositionHeader?.value.toLowerCase() || '';
      
      // 检查是否为音频内容类型
      const isAudioContentType = audioMimeTypes.some(type => contentType.includes(type));
      
      // 检查Content-Disposition中是否包含音频文件扩展名
      const hasAudioExtension = audioExtensions.some(ext => contentDisposition.includes(ext));
      
      // 如果是音频内容类型、URL匹配音频模式或Content-Disposition包含音频扩展名
      if (isAudioContentType || isAudioUrl(details.url) || hasAudioExtension) {
        console.log('检测到音频请求:', details.url);
        console.log('Content-Type:', contentType);
        console.log('Content-Disposition:', contentDisposition);
        
        // 将新的音频URL添加到数组开头
        if (!detectedAudioRequests.includes(details.url)) {
          detectedAudioRequests.unshift(details.url);
        }
        
        // 发送消息到content script
        if (details.tabId && details.tabId >= 0) {
          chrome.tabs.sendMessage(details.tabId, {
            action: 'newAudioDetected',
            audioUrl: details.url,
            contentType: contentType,
            contentDisposition: contentDisposition
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