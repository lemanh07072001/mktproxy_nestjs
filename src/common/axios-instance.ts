import axios from 'axios';

const instance = axios.create({
  baseURL: process.env.API_BASE_URL,
  timeout: 2000,
  headers: {
    'X-Custom-Header': 'foobar',
  },
});

export default instance;
