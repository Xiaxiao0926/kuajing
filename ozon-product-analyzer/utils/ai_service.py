import os
import json
import requests
from openai import OpenAI
from typing import Optional, Dict, Any

CONFIG_FILE = os.path.join(os.path.dirname(__file__), '..', 'ai_config.json')

class AIService:
    SUPPORTED_MODELS = {
        'gpt-4o': {
            'name': 'GPT-4o',
            'provider': 'openai',
            'description': 'OpenAI GPT-4o 模型'
        },
        'gpt-4': {
            'name': 'GPT-4',
            'provider': 'openai',
            'description': 'OpenAI GPT-4 模型'
        },
        'gpt-3.5-turbo': {
            'name': 'GPT-3.5 Turbo',
            'provider': 'openai',
            'description': 'OpenAI GPT-3.5 Turbo 模型'
        },
        'glm-4': {
            'name': 'GLM-4',
            'provider': 'baidu',
            'description': '百度文心一言 GLM-4 模型'
        },
        'glm-4v': {
            'name': 'GLM-4V',
            'provider': 'baidu',
            'description': '百度文心一言 GLM-4V 多模态模型'
        }
    }

    def __init__(self):
        self.config = self._load_config()
        self.openai_client = None
        self._init_clients()

    def _load_config(self) -> Dict[str, Any]:
        default_config = {
            'default_model': 'gpt-4o',
            'openai_api_key': '',
            'openai_base_url': 'https://api.openai.com/v1',
            'baidu_api_key': '',
            'baidu_secret_key': '',
            'baidu_base_url': 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/'
        }
        
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                    saved = json.load(f)
                    default_config.update(saved)
            except:
                pass
        
        return default_config

    def _init_clients(self):
        if self.config.get('openai_api_key'):
            self.openai_client = OpenAI(
                api_key=self.config['openai_api_key'],
                base_url=self.config['openai_base_url']
            )

    def save_config(self, config: Dict[str, Any]) -> bool:
        try:
            self.config.update(config)
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=2, ensure_ascii=False)
            self._init_clients()
            return True
        except Exception as e:
            print(f"保存配置失败: {e}")
            return False

    def get_baidu_access_token(self) -> Optional[str]:
        api_key = self.config.get('baidu_api_key')
        secret_key = self.config.get('baidu_secret_key')
        if not api_key or not secret_key:
            return None
        
        url = "https://aip.baidubce.com/oauth/2.0/token"
        params = {
            'grant_type': 'client_credentials',
            'client_id': api_key,
            'client_secret': secret_key
        }
        
        try:
            response = requests.post(url, params=params)
            response.raise_for_status()
            return response.json().get('access_token')
        except Exception as e:
            print(f"获取百度access_token失败: {e}")
            return None

    def chat_completion(self, messages: list, model: str = None, **kwargs) -> Dict[str, Any]:
        model = model or self.config.get('default_model', 'gpt-4o')
        
        if model not in self.SUPPORTED_MODELS:
            return {'success': False, 'error': f'不支持的模型: {model}'}
        
        provider = self.SUPPORTED_MODELS[model]['provider']
        
        try:
            if provider == 'openai':
                return self._openai_chat(messages, model, **kwargs)
            elif provider == 'baidu':
                return self._baidu_chat(messages, model, **kwargs)
            else:
                return {'success': False, 'error': f'未知的服务提供商: {provider}'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _openai_chat(self, messages: list, model: str, **kwargs) -> Dict[str, Any]:
        if not self.openai_client:
            return {'success': False, 'error': 'OpenAI客户端未初始化，请配置API Key'}
        
        response = self.openai_client.chat.completions.create(
            model=model,
            messages=messages,
            **kwargs
        )
        
        return {
            'success': True,
            'data': {
                'content': response.choices[0].message.content,
                'model': model,
                'usage': {
                    'prompt_tokens': response.usage.prompt_tokens,
                    'completion_tokens': response.usage.completion_tokens,
                    'total_tokens': response.usage.total_tokens
                }
            }
        }

    def _baidu_chat(self, messages: list, model: str, **kwargs) -> Dict[str, Any]:
        access_token = self.get_baidu_access_token()
        if not access_token:
            return {'success': False, 'error': '百度API Key未配置或获取access_token失败'}
        
        endpoint = 'glm-4' if model == 'glm-4' else 'glm-4v'
        url = f"{self.config['baidu_base_url']}{endpoint}?access_token={access_token}"
        
        payload = {
            'messages': messages,
            'temperature': kwargs.get('temperature', 0.7),
            'max_tokens': kwargs.get('max_tokens', 2048)
        }
        
        response = requests.post(url, json=payload)
        response.raise_for_status()
        result = response.json()
        
        if result.get('code') != 0:
            return {'success': False, 'error': result.get('message', '未知错误')}
        
        return {
            'success': True,
            'data': {
                'content': result['result'],
                'model': model,
                'usage': result.get('usage', {})
            }
        }

    def get_models(self) -> list:
        return [
            {'id': model_id, 'name': info['name'], 'provider': info['provider'], 'description': info['description']}
            for model_id, info in self.SUPPORTED_MODELS.items()
        ]

    def get_config(self) -> Dict[str, Any]:
        return {k: v for k, v in self.config.items() if not k.endswith('_key')}

    def is_configured(self, model: str = None) -> bool:
        model = model or self.config.get('default_model', 'gpt-4o')
        provider = self.SUPPORTED_MODELS.get(model, {}).get('provider')
        
        if provider == 'openai':
            return bool(self.config.get('openai_api_key'))
        elif provider == 'baidu':
            return bool(self.config.get('baidu_api_key')) and bool(self.config.get('baidu_secret_key'))
        return False