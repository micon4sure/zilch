export default class Sender {
  wait: number = 0;
  callback: Function;

  constructor(callback: Function) {
    this.callback = callback;
  }

  async send(message: String) {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.callback(message);
        this.wait--;
        resolve(true);
      }, 100 * this.wait++);
    });
  }
}