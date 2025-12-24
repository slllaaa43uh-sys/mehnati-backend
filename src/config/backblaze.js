const B2 = require('backblaze-b2');

// Backblaze B2 Configuration
const b2 = new B2({
  applicationKeyId: process.env.B2_APPLICATION_KEY_ID,
  applicationKey: process.env.B2_APPLICATION_KEY
});

let authData = null;
let bucketId = null;

// تهيئة الاتصال بـ Backblaze B2
const initializeB2 = async () => {
  try {
    // المصادقة
    const authResponse = await b2.authorize();
    authData = authResponse.data;
    
    // الحصول على معرف الـ Bucket
    const bucketName = process.env.B2_BUCKET_NAME;
    const bucketsResponse = await b2.listBuckets();
    const bucket = bucketsResponse.data.buckets.find(b => b.bucketName === bucketName);
    
    if (bucket) {
      bucketId = bucket.bucketId;
      console.log(`✅ Backblaze B2 متصل بنجاح - Bucket: ${bucketName}`);
    } else {
      // إنشاء bucket جديد إذا لم يكن موجوداً
      const newBucket = await b2.createBucket({
        bucketName: bucketName,
        bucketType: 'allPublic'
      });
      bucketId = newBucket.data.bucketId;
      console.log(`✅ تم إنشاء Bucket جديد: ${bucketName}`);
    }
    
    return { authData, bucketId };
  } catch (error) {
    console.error('❌ خطأ في الاتصال بـ Backblaze B2:', error.message);
    throw error;
  }
};

// الحصول على رابط الرفع
const getUploadUrl = async () => {
  try {
    if (!authData || !bucketId) {
      await initializeB2();
    }
    
    const uploadUrlResponse = await b2.getUploadUrl({
      bucketId: bucketId
    });
    
    return uploadUrlResponse.data;
  } catch (error) {
    // إعادة المصادقة في حالة انتهاء الصلاحية
    if (error.response && error.response.status === 401) {
      await initializeB2();
      return getUploadUrl();
    }
    throw error;
  }
};

// رفع ملف إلى Backblaze B2
const uploadFile = async (fileBuffer, fileName, contentType) => {
  try {
    const uploadUrl = await getUploadUrl();
    
    const uploadResponse = await b2.uploadFile({
      uploadUrl: uploadUrl.uploadUrl,
      uploadAuthToken: uploadUrl.authorizationToken,
      fileName: fileName,
      data: fileBuffer,
      contentType: contentType
    });
    
    // إنشاء رابط الملف العام
    const downloadUrl = `${authData.downloadUrl}/file/${process.env.B2_BUCKET_NAME}/${fileName}`;
    
    return {
      fileId: uploadResponse.data.fileId,
      fileName: uploadResponse.data.fileName,
      contentType: uploadResponse.data.contentType,
      contentLength: uploadResponse.data.contentLength,
      url: downloadUrl
    };
  } catch (error) {
    console.error('❌ خطأ في رفع الملف:', error.message);
    throw error;
  }
};

// حذف ملف من Backblaze B2
const deleteFile = async (fileId, fileName) => {
  try {
    if (!authData) {
      await initializeB2();
    }
    
    await b2.deleteFileVersion({
      fileId: fileId,
      fileName: fileName
    });
    
    return true;
  } catch (error) {
    console.error('❌ خطأ في حذف الملف:', error.message);
    throw error;
  }
};

// الحصول على معلومات الملف
const getFileInfo = async (fileId) => {
  try {
    if (!authData) {
      await initializeB2();
    }
    
    const fileInfo = await b2.getFileInfo({
      fileId: fileId
    });
    
    return fileInfo.data;
  } catch (error) {
    console.error('❌ خطأ في الحصول على معلومات الملف:', error.message);
    throw error;
  }
};

module.exports = {
  initializeB2,
  getUploadUrl,
  uploadFile,
  deleteFile,
  getFileInfo,
  getAuthData: () => authData,
  getBucketId: () => bucketId
};
