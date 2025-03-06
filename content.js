console.log("Content script injected successfully!");



// 存储检测到的音频请求
let detectedAudioRequests = new Set();

// 拦截XHR请求
const originalXHROpen = XMLHttpRequest.prototype.open;

console.log(XMLHttpRequest.prototype.open === originalXHROpen);

XMLHttpRequest.prototype.open = function(method, url) {
  const xhr = this;

  console.log("hello worodsasdf")
  
  xhr.addEventListener('load', function() {
    const contentType = xhr.getResponseHeader('content-type');
    const status = xhr.status;
    // 增加对206状态码和audio/mp4类型的支持
    if ((status === 200 || status === 206) && 
        (isAudioUrl(url) || 
         (contentType && (
           contentType.includes('audio') || 
           contentType.includes('media') || 
           contentType.includes('stream') ||
           contentType.includes('mp4') ||
           contentType.includes('application/octet-stream')
         ))
        )) {
      console.log('检测到音频请求:', url);
      console.log('Content-Type:', contentType);
      detectedAudioRequests.add(url);
    }
  });
  return originalXHROpen.apply(this, arguments);
};

// 拦截Fetch请求
const originalFetch = window.fetch;
window.fetch = function(url, options) {
  const promise = originalFetch.apply(this, arguments);
  promise.then(response => {
    const contentType = response.headers.get('content-type');
    const status = response.status;
    // 增加对206状态码和audio/mp4类型的支持
    if ((status === 200 || status === 206) && 
        (isAudioUrl(url.toString()) || 
         (contentType && (
           contentType.includes('audio') || 
           contentType.includes('media') || 
           contentType.includes('stream') ||
           contentType.includes('audio/mp4') ||
           contentType.includes('application/octet-stream')
         ))
        )) {
      console.log('检测到音频请求:', url.toString());
      console.log('Content-Type:', contentType);
      detectedAudioRequests.add(url.toString());
    }
  });
  return promise;
};

// 判断URL是否为音频链接
function isAudioUrl(url) {
  const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.wma', '.ape', '.opus', '.mid', '.midi', '.amr', '.m4r', '.ac3', '.dsf', '.dff'];
  const audioKeywords = ['audio', 'music', 'media', 'stream', 'jdyyaac', 'song', 'musicfile'];
  const urlLower = url.toLowerCase();

  console.log('正在检查URL:', urlLower);
  
  // 特殊处理网易云音乐的URL模式
  if (urlLower.includes('music.163.com') || urlLower.includes('.music.126.net')) {
    console.log('检测到网易云音乐URL:', urlLower);
    const isMatch = urlLower.includes('/weapi/song/enhance/player/url') ||
           urlLower.includes('/api/song/enhance/player/url') ||
           urlLower.includes('/song/url') ||
           urlLower.includes('/weapi/song/url') ||
           urlLower.includes('/api/cloud/get/byid') ||
           urlLower.includes('/eapi/song/enhance/player/url') ||
           urlLower.includes('/eapi/song/url') ||
           urlLower.includes('/eapi/v1/song/url') ||
           urlLower.includes('/eapi/v3/song/url') ||
           urlLower.includes('/neapi/song/url') ||
           urlLower.includes('/neapi/player/url') ||
           urlLower.includes('.m4a') ||
           urlLower.includes('m7c6') ||
           urlLower.includes('m704') ||
           urlLower.includes('m8c6') ||
           urlLower.includes('m804') ||
           urlLower.includes('m8') ||
           urlLower.includes('m7') ||
           urlLower.includes('m9') ||
           urlLower.includes('m10') ||
           urlLower.includes('/song/media/outer/url') ||
           urlLower.includes('/song/enhance/download/url') ||
           urlLower.includes('/song/enhance/player/url/v1') ||
           urlLower.includes('/song/enhance/player/url/v2') ||
           urlLower.includes('jdyyaac') ||
           urlLower.includes('/weapi/song/download/url') ||
           urlLower.includes('/api/song/download/url') ||
           urlLower.includes('/eapi/song/download/url') ||
           urlLower.includes('/neapi/song/download/url') ||
           urlLower.includes('/song/download/url') ||
           (urlLower.includes('.m4a') && (urlLower.includes('authsecret=') || urlLower.includes('vuutv=')));
    console.log('网易云音乐URL匹配结果:', isMatch);
    return isMatch;
  }
  
  const isAudioExtension = audioExtensions.some(ext => {
    const hasExt = urlLower.includes(ext);
    if (hasExt) console.log('匹配到音频扩展名:', ext);
    return hasExt;
  });

  console.log('检查音频关键词...');
  const hasAudioKeyword = audioKeywords.some(keyword => {
    const hasKeyword = urlLower.includes(keyword);
    if (hasKeyword) console.log('匹配到音频关键词:', keyword);
    return hasKeyword;
  });
  
  const result = isAudioExtension || hasAudioKeyword;
  console.log('URL检查结果:', result ? '是音频链接' : '不是音频链接');
  return result;
}

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