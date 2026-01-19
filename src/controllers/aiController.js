const axios = require('axios');

// ============================================
// 🤖 LLM Configuration
// ============================================
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'http://localhost:11434';
const LLM_MODEL = process.env.LLM_MODEL || 'qwen2.5:7b-instruct';

// Assistant name (configurable)
const ASSISTANT_NAME = process.env.ASSISTANT_NAME || 'مستشار مهنتي لي';

// ============================================
// 🎭 System Persona (strict Arabic prompt)
// ============================================
const SYSTEM_PROMPT = `أنت "مستشار مهنتي لي"، خبير في الموارد البشرية وتطوير الذات.
مهمتك: تقديم نصائح ذهبية للمستخدمين، مساعدتهم في كتابة السيرة الذاتية، وتحفيزهم.

**قواعدك:**
- أنت متخصص فقط في (الوظائف، المقابلات، السيرة الذاتية، تطوير المهارات).
- إذا طلب المستخدم البحث عن وظيفة، قل له بأدب: "حالياً أنا هنا لنصحك وتجهيزك للوظيفة، يمكنك البحث في قسم الوظائف بالتطبيق 🚀".
- تحدث بلهجة عربية بيضاء ومحترفة.
- اجعل إجاباتك مفيدة، مختصرة، ومليئة بالطاقة الإيجابية.`;

// ============================================
// 📡 Chat handler (Chat & Advice Assistant only)
// - DB/search logic intentionally NOT called in this version.
// ============================================
exports.chatWithAI = async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'الرجاء إدخال رسالة' });
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const userMessage = message.trim();
    const lowerMessage = userMessage.toLowerCase();

    // ---------------------------
    // Local quick replies (no DB)
    // ---------------------------
    if (lowerMessage.includes('ما اسمك') || lowerMessage.includes('ما هو اسمك')) {
      const reply = `اسمي ${ASSISTANT_NAME}. أنا هنا لأقدّم لك نصائح مهنية ومساعدة عند الطلب.`;
      res.write('data: ' + JSON.stringify({ type: 'chunk', content: reply }) + '\n\n');
      res.write('data: ' + JSON.stringify({ type: 'done', fullResponse: reply }) + '\n\n');
      res.end();
      return;
    }

    if (lowerMessage.includes('من صنعك') || lowerMessage.includes('من طورك') || lowerMessage.includes('من برمجك')) {
      const reply = 'تم تطويري من قبل المطور صلاح مهدلي';
      res.write('data: ' + JSON.stringify({ type: 'chunk', content: reply }) + '\n\n');
      res.write('data: ' + JSON.stringify({ type: 'done', fullResponse: reply }) + '\n\n');
      res.end();
      return;
    }

    // Capture "اسمي ..." or "أنا ..." (temporary for current conversation)
    const nameMatch = userMessage.match(/^(?:اسمي|أنا|انا)\s+(.+)$/i);
    if (nameMatch && nameMatch[1]) {
      const userName = nameMatch[1].trim();
      const reply = `تم تسجيل اسمك للمحادثة: ${userName}. مرحبًا ${userName}. سأستخدم هذا الاسم أثناء هذه المحادثة عند الحاجة.`;
      res.write('data: ' + JSON.stringify({ type: 'chunk', content: reply }) + '\n\n');
      res.write('data: ' + JSON.stringify({ type: 'done', fullResponse: reply }) + '\n\n');
      res.end();
      return;
    }

    if (lowerMessage.includes('اقترح اسم انجليزي') || lowerMessage.includes('اسم انجليزي')) {
      const suggestions = ['Salah', 'Mohammed', 'Sal', 'Salah M.'];
      const reply = `أقترح الأسماء الإنجليزية التالية: ${suggestions.join(', ')}.`;
      res.write('data: ' + JSON.stringify({ type: 'chunk', content: reply }) + '\n\n');
      res.write('data: ' + JSON.stringify({ type: 'done', fullResponse: reply }) + '\n\n');
      res.end();
      return;
    }

    // ---------------------------
    // Detect job-create or job-search intents and reply politely (no DB)
    // ---------------------------
    const createJobPhrases = ['انشئ وظيفة', 'أنشئ وظيفة', 'انشئ لي وظيفة', 'انشئ اعلان وظيفة', 'انشأ وظيفة', 'انشأ اعلان وظيفة', 'اعلن وظيفة', 'سجل وظيفة'];
    const searchJobPhrases = ['ابحث عن وظيفة', 'ابحث لي عن وظيفة', 'ابحث عن وظائف', 'ابحث لي عن وظائف', 'ابعث لي وظيفة', 'ارسل لي وظائف', 'اعرض لي وظائف', 'جلب وظائف'];

    for (const p of createJobPhrases) {
      if (lowerMessage.includes(p)) {
        const reply = 'حالياً أنا هنا لنصحك وتجهيزك للوظيفة، يمكنك البحث في قسم الوظائف بالتطبيق 🚀';
        res.write('data: ' + JSON.stringify({ type: 'chunk', content: reply }) + '\n\n');
        res.write('data: ' + JSON.stringify({ type: 'done', fullResponse: reply }) + '\n\n');
        res.end();
        return;
      }
    }

    for (const p of searchJobPhrases) {
      if (lowerMessage.includes(p)) {
        const reply = 'حالياً أنا هنا لنصحك وتجهيزك للوظيفة، يمكنك البحث في قسم الوظائف بالتطبيق 🚀';
        res.write('data: ' + JSON.stringify({ type: 'chunk', content: reply }) + '\n\n');
        res.write('data: ' + JSON.stringify({ type: 'done', fullResponse: reply }) + '\n\n');
        res.end();
        return;
      }
    }

    // ---------------------------
    // Default: forward to LLM for chat/advice (DB/search disabled)
    // ---------------------------
    res.write('data: ' + JSON.stringify({ type: 'status', status: 'responding', message: 'يكتب ✍️' }) + '\n\n');

    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    const recent = conversationHistory.slice(-6);
    for (let k = 0; k < recent.length; k++) {
      messages.push({ role: recent[k].role === 'user' ? 'user' : 'assistant', content: recent[k].content });
    }
    messages.push({ role: 'user', content: userMessage });

    try {
      const response = await axios.post(
        LLM_BASE_URL + '/api/chat',
        {
          model: LLM_MODEL,
          messages: messages,
          stream: true,
          options: { temperature: 0.2 }
        },
        { responseType: 'stream', timeout: 60000 }
      );

      let fullText = '';
      response.data.on('data', function(chunk) {
        const lines = chunk.toString().split('\n');
        for (let m = 0; m < lines.length; m++) {
          if (!lines[m].trim()) continue;
          try {
            const data = JSON.parse(lines[m]);
            if (data.message && data.message.content) {
              fullText += data.message.content;
              res.write('data: ' + JSON.stringify({ type: 'chunk', content: data.message.content }) + '\n\n');
            }
            if (data.done) {
              res.write('data: ' + JSON.stringify({ type: 'done', fullResponse: fullText }) + '\n\n');
              res.end();
            }
          } catch (e) {
            // ignore parse errors
          }
        }
      });

      response.data.on('error', function() {
        res.write('data: ' + JSON.stringify({ type: 'error', message: 'حدث خطأ عند الاتصال بالنموذج' }) + '\n\n');
        res.end();
      });

    } catch (err) {
      console.error('LLM error:', err.message);
      res.write('data: ' + JSON.stringify({ type: 'error', message: 'الخدمة غير متاحة حالياً' }) + '\n\n');
      res.end();
    }

  } catch (error) {
    console.error('Chat error:', error);
    if (!res.headersSent) res.setHeader('Content-Type', 'text/event-stream');
    res.write('data: ' + JSON.stringify({ type: 'error', message: 'حدث خطأ' }) + '\n\n');
    res.end();
  }
};
