import "babel-core/register";
import "babel-polyfill";
import admin from "firebase-admin";
import moment from "moment";
import axios from "axios";
import dotenv from "dotenv";
import { asyncForEach, capitalize } from "./utils";

dotenv.config();

admin.initializeApp({
  credential: admin.credential.cert({
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  }),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const db = admin.database();

let userData = [];
const currentYear = moment().year();
const currentWeek = moment().week();
const currentDay = moment().weekday();
const weekdayLocale = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  ko: ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"],
};

const getListUsers = async () => {
  const listUsersResult = await admin.auth().listUsers();

  asyncForEach(listUsersResult.users, (userRecord) => {
    userData.push({
      uid: userRecord.uid,
      name: userRecord.displayName.split(" ")[0],
      pomos: 0,
    });
  });
};

const getSnapshot = async () => {
  await asyncForEach(userData, async (user, index) => {
    const PomosRef = db.ref(
      `/pomos/${user.uid}/y${currentYear}/w${currentWeek}`
    );
    const Pomos = await PomosRef.once("value");

    const val = Pomos.val();

    if (val) {
      userData[index].pomos = Object.keys(val).length;
    } else {
      userData[index].pomos = 0;
    }
  });
};

const sendMessage = async () => {
  const { TELEGRAM_TOKEN, TELEGRAM_CHAT_ID } = process.env;
  const TELEGRAM_API_ENDPOINT = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendmessage`;

  let text = `${currentYear}년 ${currentWeek}주차 ${weekdayLocale["ko"][currentDay]} 뽀모도로 현황\n`;
  text += "=====================\n";

  userData.map(
    (user) => (text += `${capitalize(user.name)}: ${user.pomos}회\n`)
  );

  try {
    await axios.post(TELEGRAM_API_ENDPOINT, {
      chat_id: TELEGRAM_CHAT_ID,
      text,
    });
  } catch (e) {
    console.error(e);
    process.exit();
  }

  process.exit();
};

const start = async () => {
  await getListUsers();
  await getSnapshot();
  await sendMessage();
};

start();
