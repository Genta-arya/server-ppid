import { Router } from "express";
import {
  deleteForm,
  DownloadFile,
  GetAllForm,
  GetAllLog,
  GetDetailForm,
  PostForm,
  updateStatus,
} from "../Controller/Form.controller.js";

const routerForm = Router();

routerForm.post("/submit", PostForm);
routerForm.get("/cek/status", GetDetailForm);
routerForm.get("/file/download", DownloadFile);
routerForm.get("/all", GetAllForm);
routerForm.put("/update/status", updateStatus);
routerForm.post("/delete", deleteForm);
routerForm.get("/log", GetAllLog);

export default routerForm;
