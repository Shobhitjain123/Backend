import multer from "multer";

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      console.log("Destination path called for:", file.fieldname);
      cb(null, "./public/temp")
    },
    filename: function (req, file, cb) {
      console.log("File uploaded:", file.originalname);
      cb(null, file.originalname)
    }
  })
  
  export const upload = multer(
    { 
        storage 
    }
)