FROM debian
RUN apt-get update && apt-get install --assume-yes netcat-openbsd
WORKDIR /usr/share/test-server
ADD server.sh /usr/share/test-server
CMD ["bash", "./server.sh"]
