const Report = require('../models/Report');

// @desc    Create report
// @route   POST /api/v1/reports
// @access  Private
exports.createReport = async (req, res, next) => {
  try {
    const { reportType, targetId, reason, details, media } = req.body;

    // Check for duplicate report
    const existingReport = await Report.findOne({
      reporter: req.user.id,
      reportType,
      targetId,
      status: { $in: ['pending', 'reviewed'] }
    });

    if (existingReport) {
      return res.status(400).json({
        success: false,
        message: 'لقد قمت بالإبلاغ عن هذا المحتوى مسبقاً'
      });
    }

    const report = await Report.create({
      reporter: req.user.id,
      reportType,
      targetId,
      reason,
      details,
      media: media || []
    });

    res.status(201).json({
      success: true,
      message: 'تم إرسال البلاغ بنجاح. سيتم مراجعته قريباً',
      report
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's reports
// @route   GET /api/v1/reports/my
// @access  Private
exports.getMyReports = async (req, res, next) => {
  try {
    const reports = await Report.find({ reporter: req.user.id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      reports
    });
  } catch (error) {
    next(error);
  }
};
