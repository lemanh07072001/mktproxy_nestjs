import axios from 'axios';

const instance = axios.create({
  baseURL: process.env.API_BASE_URL,
  headers: {
    'X-Custom-Header': 'foobar',
  },
});

export default instance;
