console.log("Content script injected successfully!");

// 存储检测到的音频请求
let detectedAudioRequests = new Set();

// 音频相关的MIME类型
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

// 拦截XHR请求
const originalXHROpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method, url) {
  const xhr = this;
  console.log("拦截到XHR请求:", url);
  
  xhr.addEventListener('load', function() {
    try {
      const contentType = xhr.getResponseHeader('content-type');
      const status = xhr.status;
      console.log("XHR响应状态:", status, "Content-Type:", contentType);
      
      if ((status === 200 || status === 206) && 
          (isAudioUrl(url) || 
           (contentType && (
             audioMimeTypes.some(type => contentType.toLowerCase().includes(type.toLowerCase()))
           ))
          )) {
        console.log('XHR检测到音频请求:', url);
        detectedAudioRequests.add(url);
        notifyBackgroundScript(url, contentType);
      }
    } catch (error) {
      console.error('处理XHR响应时出错:', error);
    }
  });
  return originalXHROpen.apply(this, arguments);
};

// 拦截Fetch请求
const originalFetch = window.fetch;
window.fetch = function(input, init) {
  const url = typeof input === 'string' ? input : input.url;
  console.log("拦截到Fetch请求:", url);
  
  const promise = originalFetch.apply(this, arguments);
  promise.then(response => {
    try {
      const contentType = response.headers.get('content-type');
      const status = response.status;
      console.log("Fetch响应状态:", status, "Content-Type:", contentType);
      
      if ((status === 200 || status === 206) && 
          (isAudioUrl(url) || 
           (contentType && (
             audioMimeTypes.some(type => contentType.toLowerCase().includes(type.toLowerCase()))
           ))
          )) {
        console.log('Fetch检测到音频请求:', url);
        detectedAudioRequests.add(url);
        notifyBackgroundScript(url, contentType);
      }
    } catch (error) {
      console.error('处理Fetch响应时出错:', error);
    }
  });
  return promise;
};

// 通知background script
function notifyBackgroundScript(url, contentType) {
  chrome.runtime.sendMessage({
    action: 'audioDetected',
    audioUrl: url,
    contentType: contentType
  }).catch(error => {
    console.error('发送消息到background script失败:', error);
  });
}

// 判断URL是否为音频链接
function isAudioUrl(url) {
  const audioExtensions = [
    '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.wma',
    '.ape', '.opus', '.mid', '.midi', '.amr', '.m4r', '.ac3',
    '.dsf', '.dff', '.webm', '.mka', '.m3u8', '.ts'
  ];
  const urlLower = url.toLowerCase();
  
  return audioExtensions.some(ext => urlLower.includes(ext));
}

// 监听来自background script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'newAudioDetected') {
    console.log('收到新的音频URL:', message.audioUrl);
    detectedAudioRequests.add(message.audioUrl);
  }
});

// 监听页面中的音频元素
function detectMusic() {
  // 使用多个选择器来查找音频元素
  const selectors = [
    'audio',
    'video',
    'audio[src]',
    'video[src]',
    '[data-audio-url]',
    '.audio-player audio',
    '.video-player video',
    '.audio-element',
    '.jp-audio audio',  // JPlayer
    '.mejs__container audio',  // MediaElement
    '.aplayer audio',  // APlayer
    '.html5-audio-player',  // HTML5 Audio Player
    '.wp-audio-shortcode',  // WordPress Audio
    'div[class*="audio"] audio',  // 通用类名匹配
    'div[class*="player"] audio',  // 通用播放器匹配
    '#g_player audio',  // 网易云音乐播放器
    '.m-player audio',  // 网易云音乐播放器
    '#main-player audio',  // 网易云音乐播放器
    '.g-single audio',  // 网易云音乐单曲播放器
    'audio[data-spm]'  // 网易云音乐数据属性
  ];

  const musicInfo = [];
  const processedSources = new Set();

  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(element => {
      try {
        // 检查元素是否有效且具有src或data-audio-url
        let src = '';
        if (element.hasAttribute('data-audio-url')) {
          src = element.getAttribute('data-audio-url');
        } else if (element instanceof HTMLMediaElement) {
          src = element.currentSrc || element.src;
        } else {
          const mediaElement = element.querySelector('audio, video');
          if (mediaElement) {
            src = mediaElement.currentSrc || mediaElement.src;
          }
        }

        if (src) {
          
          // 避免重复添加相同源的音频
          if (!processedSources.has(src)) {
            processedSources.add(src);
            
            // 即使音频暂停也收集信息，但标记其状态
            const info = {
              title: getMusicTitle(element),
              duration: element.duration || 0,
              currentTime: element.currentTime || 0,
              src: src,
              isPlaying: !element.paused
            };
            musicInfo.push(info);
          }
        }
      } catch (error) {
        console.warn('Error processing audio element:', error);
      }
    });
  });


  // 添加从XHR和Fetch请求中检测到的音频
  detectedAudioRequests.forEach(audioUrl => {
    if (!processedSources.has(audioUrl)) {
      processedSources.add(audioUrl);
      const info = {
        title: audioUrl.split('/').pop().split('?')[0],
        duration: 0,
        currentTime: 0,
        src: audioUrl,
        isPlaying: false
      };
      musicInfo.push(info);
    }
  });

  return musicInfo;
}

// 尝试获取音乐标题
function getMusicTitle(element) {
  // 尝试从data-title属性获取
  const dataTitle = element.getAttribute('data-title');
  if (dataTitle) return dataTitle;

  // 尝试从父元素或相邻元素获取标题
  const parentTitle = element.closest('[title]');
  if (parentTitle) return parentTitle.getAttribute('title');

  // 如果都没有，返回音频源文件名
  const src = element.currentSrc;
  return src.split('/').pop().split('?')[0];
}

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'detectMusic') {
    const musicInfo = detectMusic();
    sendResponse({ musicInfo });
  }
});

// 发送消息到扩展的辅助函数
function sendMessageToExtension(message) {
  if (!chrome.runtime?.id) {
    return;
  }
  try {
    chrome.runtime.sendMessage(message);
  } catch (error) {}
}

// 实时监听音频状态变化
function handleAudioStateChange(event) {
  try {
    const element = event.target;
    if (!(element instanceof HTMLMediaElement)) {
      return;
    }
    const isPlaying = !element.paused && !element.ended && element.currentTime > 0;
    sendMessageToExtension({ 
      action: 'musicStateChanged',
      state: {
        src: element.currentSrc || element.src,
        isPlaying: isPlaying
      }
    });
  } catch (error) {}
}

// 只保留必要的事件监听
document.addEventListener('play', handleAudioStateChange, true);
document.addEventListener('pause', handleAudioStateChange, true);
document.addEventListener('ended', handleAudioStateChange, true);