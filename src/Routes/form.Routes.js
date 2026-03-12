import { Router } from "express";
import {
  deleteForm,
  DownloadFile,
  GetAllForm,
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

export default routerForm;
