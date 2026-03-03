import { Router } from "express";
import {
  DownloadFile,
  GetDetailForm,
  PostForm,
} from "../Controller/Form.controller.js";

const routerForm = Router();

routerForm.post("/submit", PostForm);
routerForm.get("/cek/status", GetDetailForm);
routerForm.get("/file/download", DownloadFile);

export default routerForm;
