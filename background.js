// background.js - 后台服务脚本

// 监听安装事件
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // 首次安装，初始化默认配置
    await initializeDefaultConfig();
    console.log('简历表单填充助手已安装');
  } else if (details.reason === 'update') {
    console.log('简历表单填充助手已更新到版本', chrome.runtime.getManifest().version);
  }
});

// 初始化默认配置
async function initializeDefaultConfig() {
  const defaultItems = [
    {
      id: '1',
      keywords: ['姓名', '名字', '您的称呼', '真实姓名', '联系人'],
      value: '张三'
    },
    {
      id: '2',
      keywords: ['手机', '手机号', '电话', '联系电话', '移动电话', '手机号码'],
      value: '13800138000'
    },
    {
      id: '3',
      keywords: ['邮箱', 'email', '电子邮箱', 'E-mail', '邮件地址'],
      value: 'zhangsan@example.com'
    },
    {
      id: '4',
      keywords: ['学历', '最高学历', '教育程度'],
      value: '本科'
    },
    {
      id: '5',
      keywords: ['毕业院校', '学校', '院校', '毕业学校', '大学'],
      value: '北京大学'
    },
    {
      id: '6',
      keywords: ['专业', '所学专业', '主修专业'],
      value: '计算机科学与技术'
    },
    {
      id: '7',
      keywords: ['工作经历', '工作经验', '工作年限'],
      value: '5年互联网行业工作经验'
    },
    {
      id: '8',
      keywords: ['地址', '家庭住址', '居住地址', '通讯地址', '详细地址'],
      value: '北京市海淀区中关村大街1号'
    },
    {
      id: '9',
      keywords: ['性别', '男/女'],
      value: '男'
    },
    {
      id: '10',
      keywords: ['年龄', '周岁'],
      value: '28'
    },
    {
      id: '11',
      keywords: ['期望薪资', '薪资要求', '期望工资', '月薪要求'],
      value: '面议'
    },
    {
      id: '12',
      keywords: ['求职意向', '应聘职位', '期望职位', '意向岗位'],
      value: '高级前端工程师'
    }
  ];

  await chrome.storage.local.set({
    fillItems: defaultItems,
    autoFillMode: true,
    manualFillMode: true,
    lastFillTime: null
  });
}

// 监听来自content script或popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getConfig') {
    chrome.storage.local.get(['fillItems', 'autoFillMode', 'manualFillMode'])
      .then(result => {
        sendResponse(result);
      });
    return true;
  }

  if (request.action === 'saveConfig') {
    chrome.storage.local.set(request.data)
      .then(() => {
        // 通知所有标签页配置已更新
        notifyAllTabs({ action: 'configUpdated' });
        sendResponse({ success: true });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

// 通知所有标签页
async function notifyAllTabs(message) {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, message);
      } catch (e) {
        // 忽略无法发送的标签页
      }
    }
  } catch (error) {
    console.error('通知标签页失败:', error);
  }
}

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 当页面加载完成时，可以在这里做一些处理
  if (changeInfo.status === 'complete' && tab.url) {
    // 可以在这里注入content script或做其他处理
  }
});
