const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");


//funktio jolla kuvat pysyy sivulla ei vain paikallisesti
const uploadToCloudinary = (buffer, folder = "quiz-app") => {
  return new Promise((resolve, reject) => {
    //cloudinary uploadataan
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
      },
      (error, result) => {
        if (result) resolve(result);
        else reject(error);
      }
    );
//streamifier reads it
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

module.exports = uploadToCloudinary;