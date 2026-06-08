function replaceVariables(template, variables) {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    if (variables && variables[key] !== undefined) {
      return String(variables[key]);
    }
    return match;
  });
}

function processConditionals(template, variables) {
  if (!template) return '';
  
  let result = template;
  
  result = result.replace(/\{\{if\s+(\w+)(?:\s*==\s*['"]?([^'"\s}]+)['"]?)?\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, expectedValue, content) => {
    let actualValue = variables ? variables[condition] : undefined;
    
    if (expectedValue !== undefined) {
      if (String(actualValue) === expectedValue) {
        return content;
      }
      return '';
    } else {
      if (actualValue && actualValue !== 'false' && actualValue !== '0') {
        return content;
      }
      return '';
    }
  });
  
  result = result.replace(/\{\{if\s+(\w+)(?:\s*==\s*['"]?([^'"\s}]+)['"]?)?\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, expectedValue, ifContent, elseContent) => {
    let actualValue = variables ? variables[condition] : undefined;
    
    if (expectedValue !== undefined) {
      if (String(actualValue) === expectedValue) {
        return ifContent;
      }
      return elseContent;
    } else {
      if (actualValue && actualValue !== 'false' && actualValue !== '0') {
        return ifContent;
      }
      return elseContent;
    }
  });
  
  return result;
}

function processSwitchLevel(template, variables) {
  if (!template) return '';
  
  return template.replace(/\{\{switch\s+level\}\}([\s\S]*?)\{\{\/switch\}\}/g, (match, switchContent) => {
    const level = variables ? variables.level : undefined;
    
    const caseMatch = switchContent.match(new RegExp(`\\{\\{case\\s+['"]?${level}['"]?\\}\\}\\s*([\\s\\S]*?)(?=\\{\\{case|\\{\\{default|\\{\\{/switch)`, 'i'));
    if (caseMatch) {
      return caseMatch[1].trim();
    }
    
    const defaultMatch = switchContent.match(/\{\{default\}\}\s*([\s\S]*?)$/);
    if (defaultMatch) {
      return defaultMatch[1].trim();
    }
    
    return '';
  });
}

function renderTemplate(template, variables) {
  let result = template;
  result = processSwitchLevel(result, variables);
  result = processConditionals(result, variables);
  result = replaceVariables(result, variables);
  return result;
}

function renderForChannel(templateVersion, channel, variables) {
  const channelRules = templateVersion.channelRules || {};
  const rule = channelRules[channel];
  
  let titleTemplate = templateVersion.titleTemplate;
  let contentTemplate = templateVersion.contentTemplate;
  
  if (rule) {
    if (rule.enabled === false) {
      return null;
    }
    if (rule.titleTemplate) {
      titleTemplate = rule.titleTemplate;
    }
    if (rule.contentTemplate) {
      contentTemplate = rule.contentTemplate;
    }
  }
  
  return {
    title: renderTemplate(titleTemplate, variables),
    content: renderTemplate(contentTemplate, variables),
  };
}

function previewTemplate({ titleTemplate, contentTemplate, channelRules, variables, channel }) {
  const vars = variables || {
    memberName: '张三',
    points: 1000,
    expireDate: '2026-12-31',
    level: 'GOLD',
    levelName: '黄金会员',
    ticketTitle: '工单标题示例',
    campaignName: '活动名称示例',
  };
  
  if (channel) {
    const rule = channelRules ? channelRules[channel] : null;
    let tTitle = titleTemplate;
    let tContent = contentTemplate;
    
    if (rule) {
      if (rule.enabled === false) {
        return { title: '', content: '', enabled: false };
      }
      if (rule.titleTemplate) tTitle = rule.titleTemplate;
      if (rule.contentTemplate) tContent = rule.contentTemplate;
    }
    
    return {
      title: renderTemplate(tTitle, vars),
      content: renderTemplate(tContent, vars),
      enabled: true,
    };
  }
  
  const channels = ['SMS', 'EMAIL', 'INAPP'];
  const result = {};
  
  channels.forEach((ch) => {
    const rule = channelRules ? channelRules[ch] : null;
    let tTitle = titleTemplate;
    let tContent = contentTemplate;
    let enabled = true;
    
    if (rule) {
      if (rule.enabled === false) {
        enabled = false;
      }
      if (rule.titleTemplate) tTitle = rule.titleTemplate;
      if (rule.contentTemplate) tContent = rule.contentTemplate;
    }
    
    result[ch] = {
      title: renderTemplate(tTitle, vars),
      content: renderTemplate(tContent, vars),
      enabled,
    };
  });
  
  return result;
}

const DEFAULT_VARIABLES = [
  { name: 'memberName', label: '会员姓名', type: 'string', description: '会员的真实姓名' },
  { name: 'points', label: '积分数量', type: 'number', description: '会员当前积分' },
  { name: 'expireDate', label: '过期日期', type: 'date', description: '积分过期日期' },
  { name: 'level', label: '会员等级', type: 'string', description: '等级代码：NORMAL/SILVER/GOLD/PLATINUM' },
  { name: 'levelName', label: '等级名称', type: 'string', description: '等级中文名称' },
  { name: 'ticketTitle', label: '工单标题', type: 'string', description: '相关工单的标题' },
  { name: 'campaignName', label: '活动名称', type: 'string', description: '相关营销活动名称' },
];

module.exports = {
  replaceVariables,
  processConditionals,
  processSwitchLevel,
  renderTemplate,
  renderForChannel,
  previewTemplate,
  DEFAULT_VARIABLES,
};
