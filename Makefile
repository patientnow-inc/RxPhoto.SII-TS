all: deploy

deploy:
	cd source/constructs && \
	./deploy.sh --profile $(PROFILE) --demoUI $(DEMOUI) --bucket $(BUCKET) --signature $(SIGNATURE) --secrets $(SECRETS) --secretsKey $(SECRETSKEY)

test:
	cd deployment && \
	chmod +x run-unit-tests.sh && ./run-unit-tests.sh