const express = require('express');
const router = express.Router();
const { toggleFollow, getFollowStatus } = require('../controllers/userController');
const { protect } = require('../middleware/auth');

router.post('/:id', protect, toggleFollow);
router.get('/:id/status', protect, getFollowStatus);

module.exports = router;
