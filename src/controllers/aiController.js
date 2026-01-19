const SYSTEM_PROMPT = "يرجى استخدام اللغة العربية فقط في جميع التفاعلات. بينما يمكنك الاستفادة من جميع قدرات النظام، يجب أن تكون استجابتك باللغة العربية فقط."

const OLLAMA_MODEL = 'qwen2.5:7b-instruct';

const OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

// Additional configurations to support Arabic responses
const ARABIC_SUPPORT_CONFIG = {
    language: 'ar',
    response_format: 'text',
    enable_arabic_input: true
};