import { expect } from 'chai';
import { SinonSpy, spy } from 'sinon';

import { afterMethod, aroundMethod, beforeMethod } from './../../lib';
import { makeMethodDecorator, Wove } from './../../lib/core';
import { Metadata } from './../../lib/core/metadata';
import { Memoize } from './fixtures/memoize';
import { Service } from './fixtures/service';

const methods: string[] = [];

require('./fixtures/cache-aspect');

describe('Aspects with @Wove', () => {
  @Wove()
  @Wove()
  class ClassA {
    foo() {}
  }

  @Wove()
  class ClassB extends ClassA {
    constructor() {
      super();
      this.foo();
      this.bar();
      this.qux();
    }

    bar() {}

    qux() {}
  }

  class LoggerAspect {
    @beforeMethod({
      methodNamePattern: /.*/,
      classNamePattern: /^ClassB|ClassA$/,
    })
    beforeLogger(meta: Metadata) {
      methods.push(meta.method.name);
    }
  }

  beforeEach(() => (methods.length = 0));

  it('should work with extended classes', () => {
    const fooSpy = spy(ClassA.prototype, 'foo');
    const barSpy = spy(ClassB.prototype, 'bar');
    const quxSpy = spy(ClassB.prototype, 'qux');

    new ClassB();

    expect(fooSpy.called).equal(true);
    expect(barSpy.called).equal(true);
    expect(quxSpy.called).equal(true);
    expect(methods).deep.eq(['foo', 'bar', 'qux']);
  });
});

describe('Aspects with @Wove and decorators', () => {
  const Log = (message: string) => {
    return (target: object, propertyKey: string | symbol) => {
      Reflect.defineMetadata(Log, { message }, target, propertyKey);
    };
  };

  @Wove()
  class ClassC {
    @Log('Foo was called')
    foo() {}
  }

  class LoggerAspectC {
    @beforeMethod({
      decorators: [Log],
    })
    beforeLogger(meta: Metadata) {
      const { message } = Reflect.getMetadata(Log, meta.method.context, meta.method.name);
      console.log(message);
    }
  }

  let logStub: SinonSpy;

  beforeEach(() => {
    methods.length = 0;
    logStub = spy(console, 'log');
  });

  afterEach(() => {
    methods.length = 0;
    logStub.restore();
  });

  it('should work with decorated classes', () => {
    const c = new ClassC();
    c.foo();
    expect(logStub.calledWith('Foo was called')).equal(true);
  });
});

describe('Aspects with decorators', () => {
  context('single decorators', () => {
    describe('@beforeMethod()', () => {
      const Log = (message: string) => {
        return makeMethodDecorator((target: object, propertyKey: string | symbol) => {
          Reflect.defineMetadata(Log, { foo: message }, target, propertyKey);
        });
      };

      class ClassD {
        @Log('Foo was called')
        foo() {}

        @Log('Bar was called')
        bar() {}
      }

      class LoggerAspectD {
        @beforeMethod({
          decorators: [Log],
        })
        beforeLogger(meta: Metadata) {
          const { foo: message } = Reflect.getMetadata(Log, meta.method.context, meta.method.name);
          console.log(message);
        }
      }

      let logStub: SinonSpy;

      beforeEach(() => {
        methods.length = 0;
        logStub = spy(console, 'log');
      });

      afterEach(() => {
        methods.length = 0;
        logStub.restore();
      });

      it('should work with decorated classes', () => {
        const d = new ClassD();
        d.foo();
        d.bar();
        expect(logStub.calledWith('Foo was called')).equal(true);
        expect(logStub.calledWith('Bar was called')).equal(true);
      });
    });

    describe('@aroundMethod()', () => {
      const Log = (message: string) => {
        return makeMethodDecorator((target: object, propertyKey: string | symbol) => {
          Reflect.defineMetadata(Log, { foo: message }, target, propertyKey);
        });
      };

      class ClassE {
        @Log('Foo was called')
        foo() {
          console.log('foo');
        }

        @Log('Bar was called')
        bar() {
          console.log('bar');
        }
      }

      class LoggerAspectE {
        @aroundMethod({
          decorators: [Log],
        })
        beforeLogger(meta: Metadata) {
          const { method } = meta;
          const { foo: message } = Reflect.getMetadata(Log, meta.method.context, meta.method.name);
          console.log(`Before: ${message}`);
          const result = method.invoke(...method.args);
          console.log(`After: ${message}`);
          return result;
        }
      }

      let logStub: SinonSpy;

      beforeEach(() => {
        methods.length = 0;
        logStub = spy(console, 'log');
      });

      afterEach(() => {
        methods.length = 0;
        logStub.restore();
      });

      it('should work with decorated classes', () => {
        const e = new ClassE();
        e.foo();
        e.bar();
        expect(logStub.withArgs('Before: Foo was called').calledOnce).equal(true);
        expect(logStub.withArgs('foo').calledOnce).equal(true);
        expect(logStub.withArgs('After: Foo was called').calledOnce).equal(true);
        expect(logStub.withArgs('Before: Bar was called').calledOnce).equal(true);
        expect(logStub.withArgs('bar').calledOnce).equal(true);
        expect(logStub.withArgs('After: Bar was called').calledOnce).equal(true);
      });

      it('should work with imported decorated classes', () => {
        const service = new Service();
        service.method1();
        expect(logStub.withArgs('Before: method1').calledOnce).equal(true);
        expect(logStub.withArgs('method1 called').calledOnce).equal(true);
        expect(logStub.withArgs('After: method1').calledOnce).equal(true);
        expect(Reflect.getMetadata(Memoize, Service.prototype.method1)).to.equal('memoize:method1');
      });
    });
  });

  context('multiple decorators', () => {
    describe('@beforeMethod()', () => {
      const Log = (message: string) => {
        return makeMethodDecorator((target: object, propertyKey: string | symbol) => {
          Reflect.defineMetadata(Log, { message }, target, propertyKey);
        });
      };

      const Cache = (key: string) => {
        return makeMethodDecorator((target: object, propertyKey: string | symbol) => {
          Reflect.defineMetadata(Cache, { key }, target, propertyKey);
        });
      };

      class ClassD {
        private _foo_member: string;
        private _bar_member: string;

        constructor() {
          this._foo_member = 'foo';
          this._bar_member = 'bar';
        }

        @Cache('foo')
        @Log('Foo was called')
        foo() {
          console.log(`member: ${this._foo_member}`);
          return this._foo_member;
        }

        @Cache('bar')
        @Log('Bar was called')
        bar() {
          console.log(`member: ${this._bar_member}`);
          return this._bar_member;
        }
      }

      class CacheAspectD {
        @aroundMethod({
          decorators: [Cache],
        })
        cache(meta: Metadata) {
          const { key } = Reflect.getMetadata(Cache, meta.method.context, meta.method.name);
          console.log('cache lookup failed');
          const result = meta.method.invoke(...meta.method.args);
          console.log(`cached: ${key}: ${result}`);
        }
      }

      class LoggerAspectD {
        @beforeMethod({
          decorators: [Log],
        })
        beforeLogger(meta: Metadata) {
          const { message } = Reflect.getMetadata(Log, meta.method.context, meta.method.name);
          console.log(`logged before: ${message}`);
        }

        @afterMethod({
          decorators: [Log],
        })
        afterLogger(meta: Metadata) {
          const { message } = Reflect.getMetadata(Log, meta.method.context, meta.method.name);
          console.log(`logged after: ${message}`);
        }
      }

      let logStub: SinonSpy;

      beforeEach(() => {
        methods.length = 0;
        logStub = spy(console, 'log');
      });

      afterEach(() => {
        methods.length = 0;
        logStub.restore();
      });

      it('should work with decorated classes', () => {
        const d = new ClassD();
        d.foo();
        d.bar();
        expect(logStub.getCall(0).calledWith('logged before: Foo was called')).equal(true);
        expect(logStub.getCall(1).calledWith('cache lookup failed')).equal(true);
        expect(logStub.getCall(2).calledWith('member: foo')).equal(true);
        expect(logStub.getCall(3).calledWith('cached: foo: foo')).equal(true);
        expect(logStub.getCall(4).calledWith('logged after: Foo was called')).equal(true);
        expect(logStub.getCall(5).calledWith('logged before: Bar was called')).equal(true);
        expect(logStub.getCall(6).calledWith('cache lookup failed')).equal(true);
        expect(logStub.getCall(7).calledWith('member: bar')).equal(true);
        expect(logStub.getCall(8).calledWith('cached: bar: bar')).equal(true);
        expect(logStub.getCall(9).calledWith('logged after: Bar was called')).equal(true);
      });
    });
  });
});
